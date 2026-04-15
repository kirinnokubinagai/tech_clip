#!/bin/bash
# check-worktrees.sh
# SessionStart hook: 全worktreeの健全性をチェック
#
# 自動処理:
# - マージ済みworktreeを自動削除（未コミット変更がない場合のみ）
#
# 検出する問題:
# 1. ネストworktree（worktree内部にworktreeが作成されている）
# 2. 不正なworktreeパス（WORKTREE_BASE 直下にない）
# 3. リベース/マージ途中の状態
# 4. 未コミットの変更（modified/staged files）
# 5. mainから遅れているブランチ

PROBLEMS=""
PROBLEM_COUNT=0

# worktreeを安全に削除（通常削除→forceフォールバック）
remove_worktree_safely() {
    local wt_path="$1"
    git worktree remove "$wt_path" 2>/dev/null && return 0
    git worktree remove --force "$wt_path" 2>/dev/null
}

# git worktree list で全worktreeを取得（main以外）
WORKTREE_PATHS=$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2)

if [ -z "$WORKTREE_PATHS" ]; then
    exit 0
fi

# リポジトリルートとworktreeベースディレクトリを取得
REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd -P)
WORKTREE_BASE=$(dirname "$REPO_ROOT")
EXPECTED_PREFIX="${WORKTREE_BASE}/"

# origin/main を最新化
git fetch origin main --quiet 2>/dev/null || true

MAIN_REF=""
if git rev-parse --verify main >/dev/null 2>&1; then
    MAIN_REF="main"
elif git rev-parse --verify origin/main >/dev/null 2>&1; then
    MAIN_REF="origin/main"
elif git rev-parse --verify refs/remotes/origin/main >/dev/null 2>&1; then
    MAIN_REF="refs/remotes/origin/main"
else
    MAIN_REF="HEAD"
fi

# Pass 1: マージ済みworktreeを自動削除
REMOVED_COUNT=0
REMOVED_NAMES=""
while IFS= read -r wt_path; do
    [ -z "$wt_path" ] && continue
    [ -d "$wt_path" ] || continue
    resolved_wt_path=$(cd "$wt_path" && pwd -P)

    # WORKTREE_BASE直下でない（ネストworktree・不正パス）はPass 2に任せる
    [[ "$resolved_wt_path" != "${EXPECTED_PREFIX}"* ]] && continue
    [[ "$resolved_wt_path" == "${REPO_ROOT}" || "$resolved_wt_path" == "${REPO_ROOT}/"* ]] && continue

    wt_head=$(git -C "$wt_path" rev-parse HEAD 2>/dev/null) || continue

    # HEADがmain系参照の祖先でなければスキップ（未マージ）
    git -C "$REPO_ROOT" merge-base --is-ancestor "$wt_head" "$MAIN_REF" 2>/dev/null || continue

    branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null)
    # 防御的バリデーション: 異常なブランチ名は処理対象外にする
    if [[ ! "$branch" =~ ^[a-zA-Z0-9/_.-]+$ ]]; then
        continue
    fi

    # branch作成直後の「まだ何も積んでいない worktree」は自動削除しない
    # main が先に進んだだけの branch まで掃除対象にすると behind 検知前に消えてしまう
    if ! git -C "$REPO_ROOT" reflog "refs/heads/$branch" --format='%gs' 2>/dev/null | grep -q '^commit:'; then
        continue
    fi

    # 未コミットの変更がある場合はスキップ
    DIRTY_OUTPUT=$(git -C "$wt_path" status --porcelain 2>/dev/null)
    DIRTY_EXIT=$?
    [ "$DIRTY_EXIT" -ne 0 ] && continue
    DIRTY=$(echo "$DIRTY_OUTPUT" | grep -v '^??' | head -1)
    [ -n "$DIRTY" ] && continue
    wt_name=$(basename "$wt_path")
    remove_worktree_safely "$wt_path" || continue
    if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
        git branch -D "$branch" 2>/dev/null || true
    fi
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
    REMOVED_NAMES="${REMOVED_NAMES:+${REMOVED_NAMES}, }${wt_name}"
done <<< "$WORKTREE_PATHS"

# Pass 1b: クローズ済みPR（マージなし）のworktreeを自動削除
# gh コマンドが使えない・未認証の場合はスキップ（graceful degradation）
# gh auth token を使用（gh auth status と異なりネットワークアクセスなしで認証確認可能）
if command -v gh >/dev/null 2>&1 && gh auth token >/dev/null 2>&1; then
    # リポジトリを動的に取得（gh コマンドのスコープを限定）
    REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")

    # リポジトリ特定できない場合はPass 1bをスキップ（不明なリポジトリへの誤操作を防ぐ）
    if [ -n "$REPO_SLUG" ]; then
        # 削除後に最新のworktreeリストを取得
        WORKTREE_PATHS_1B=$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2)
        while IFS= read -r wt_path; do
            [ -z "$wt_path" ] && continue
            [ -d "$wt_path" ] || continue
            resolved_wt_path=$(cd "$wt_path" && pwd -P)

            # WORKTREE_BASE直下でない（ネストworktree・不正パス）はスキップ
            [[ "$resolved_wt_path" != "${EXPECTED_PREFIX}"* ]] && continue
            [[ "$resolved_wt_path" == "${REPO_ROOT}" || "$resolved_wt_path" == "${REPO_ROOT}/"* ]] && continue

            branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null)
            if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
                continue
            fi

            # ブランチ名のバリデーション（英数字、ハイフン、スラッシュ、アンダースコア、ドットのみ許可）
            if [[ ! "$branch" =~ ^[a-zA-Z0-9/_.-]+$ ]]; then
                continue
            fi

            # PRがクローズされているか確認（stateがCLOSED、mergedAtがnull）
            pr_state=$(gh pr list --repo "$REPO_SLUG" --head "$branch" --state closed --json state,mergedAt --jq '.[0] | select(.mergedAt == null) | .state' 2>/dev/null)
            if [ "$pr_state" != "CLOSED" ]; then
                continue
            fi

            wt_name=$(basename "$wt_path")
            # 未コミットの変更がある場合はスキップして警告
            DIRTY_OUTPUT=$(git -C "$wt_path" status --porcelain 2>/dev/null)
            DIRTY_EXIT=$?
            if [ "$DIRTY_EXIT" -ne 0 ]; then
                continue  # git status 失敗時はスキップ（安全側に倒す）
            fi
            DIRTY=$(echo "$DIRTY_OUTPUT" | grep -v '^??' | head -1)
            if [ -n "$DIRTY" ]; then
                PROBLEMS="${PROBLEMS}[クローズ済みPR] ${wt_name}: PRはクローズ済みだが未コミットの変更がある -> 変更を確認してから手動で削除: git worktree remove ${wt_path} | "
                PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
                continue
            fi

            remove_worktree_safely "$wt_path" || continue
            if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
                git branch -D "$branch" 2>/dev/null || true
            fi
            REMOVED_COUNT=$((REMOVED_COUNT + 1))
            REMOVED_NAMES="${REMOVED_NAMES:+${REMOVED_NAMES}, }${wt_name}(closed)"
        done <<< "$WORKTREE_PATHS_1B"
    fi  # [ -n "$REPO_SLUG" ]
fi  # gh auth token

# Pass 2: 残りのworktreeの健全性チェック（削除後に再取得）
WORKTREE_PATHS=$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2)

while IFS= read -r wt_path; do
    [ -z "$wt_path" ] && continue
    [ -d "$wt_path" ] || continue
    resolved_wt_path=$(cd "$wt_path" && pwd -P)

    wt_name=$(basename "$wt_path")

    # ネストworktree検出: REPO_ROOT配下にworktreeが作成されている
    if [[ "$resolved_wt_path" == "${REPO_ROOT}/"* ]]; then
        PROBLEMS="${PROBLEMS}[ネスト] ${wt_name}: REPO_ROOT内部にworktreeが作成されている -> git worktree remove --force ${wt_path} で除去し ${WORKTREE_BASE}/ 直下に再作成 | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # worktreeパスの正当性チェック: WORKTREE_BASE 直下にあるか
    if [[ "$resolved_wt_path" != "${EXPECTED_PREFIX}"* ]]; then
        PROBLEMS="${PROBLEMS}[不正パス] ${wt_name}: ${WORKTREE_BASE}/ 配下にない不正なパス -> 正しいパスに再作成すること | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # WORKTREE_BASE直下であることを確認（サブディレクトリ内はNG）
    local_path="${resolved_wt_path#${EXPECTED_PREFIX}}"
    if [[ "$local_path" == */* ]]; then
        PROBLEMS="${PROBLEMS}[ネスト] ${wt_name}: ${WORKTREE_BASE}/ の直下ではなくネストしている -> ${WORKTREE_BASE}/ 直下に再作成 | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # git dir を解決（worktreeは .git ファイルで実際のgit dirを指す）
    GIT_DIR=""
    if [ -f "$wt_path/.git" ]; then
        GIT_DIR=$(sed 's/^gitdir: //' "$wt_path/.git")
        # パストラバーサル防止: gitdir に .. が含まれる場合は無効化
        case "$GIT_DIR" in
            *".."*) GIT_DIR="" ;;
        esac
        # 相対パスを絶対パスに解決
        if [ -n "$GIT_DIR" ] && [[ "$GIT_DIR" != /* ]]; then
            GIT_DIR="$wt_path/$GIT_DIR"
        fi
    elif [ -d "$wt_path/.git" ]; then
        GIT_DIR="$wt_path/.git"
    fi

    # リベース/マージ途中チェック（ファイルベース、ロケール非依存）
    if [ -n "$GIT_DIR" ]; then
        if [ -d "$GIT_DIR/rebase-merge" ] || [ -d "$GIT_DIR/rebase-apply" ]; then
            PROBLEMS="${PROBLEMS}[リベース中] ${wt_name}: rebase途中 -> git -C ${wt_path} rebase --continue または --abort | "
            PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
            continue
        fi
        if [ -f "$GIT_DIR/MERGE_HEAD" ]; then
            PROBLEMS="${PROBLEMS}[マージ中] ${wt_name}: merge途中 -> git -C ${wt_path} merge --continue または --abort | "
            PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
            continue
        fi
    fi

    # 未コミットの変更チェック
    DIRTY_LINES=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??')
    DIRTY=$(echo "$DIRTY_LINES" | head -1)
    if [ -n "$DIRTY" ]; then
        DIRTY_COUNT=$(echo "$DIRTY_LINES" | wc -l | tr -d ' ')
        PROBLEMS="${PROBLEMS}[未コミット] ${wt_name}: ${DIRTY_COUNT}件の変更 -> git -C ${wt_path} add -A && git commit | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
    fi

    # mainから遅れているかチェック
    BEHIND=$(git -C "$wt_path" rev-list --count "HEAD..${MAIN_REF}" 2>/dev/null)
    if [ -n "$BEHIND" ] && [ "$BEHIND" -gt 0 ]; then
        PROBLEMS="${PROBLEMS}[遅れ] ${wt_name}: ${BEHIND} commits behind main -> git -C ${wt_path} merge origin/main | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
    fi

    # PRが存在しないブランチで未コミット変更なし → 警告（放置されたworktreeの可能性）
    branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ -n "$branch" ] && [ "$branch" != "HEAD" ] && [[ "$branch" =~ ^[a-zA-Z0-9/_.-]+$ ]]; then
        if command -v gh >/dev/null 2>&1 && gh auth token >/dev/null 2>&1; then
            REPO_SLUG_P2=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")
            if [ -n "$REPO_SLUG_P2" ]; then
                pr_count=$(gh pr list --repo "$REPO_SLUG_P2" --head "$branch" --state all --json number --jq 'length' 2>/dev/null || echo "")
                if [ "$pr_count" = "0" ]; then
                    DIRTY_CHECK=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??' | head -1)
                    if [ -z "$DIRTY_CHECK" ]; then
                        PROBLEMS="${PROBLEMS}[PR無し] ${wt_name}: PRが存在しないブランチ -> 不要なら git worktree remove ${wt_path} で削除 | "
                        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
                    fi
                fi
            fi
        fi
    fi

    # 14日以上コミットされていないworktree → 警告
    LAST_COMMIT_DATE=$(git -C "$wt_path" log -1 --format="%ct" 2>/dev/null || echo "")
    if [ -n "$LAST_COMMIT_DATE" ]; then
        NOW=$(date +%s)
        STALE_THRESHOLD=1209600
        AGE=$((NOW - LAST_COMMIT_DATE))
        if [ "$AGE" -gt "$STALE_THRESHOLD" ]; then
            DAYS=$((AGE / 86400))
            PROBLEMS="${PROBLEMS}[古い] ${wt_name}: ${DAYS}日間コミットなし -> 不要なら scripts/cleanup-worktrees.sh で削除 | "
            PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        fi
    fi
done <<< "$WORKTREE_PATHS"

# /tmp/issue-* 古いファイルを削除（24時間以上前）
TMP_DELETED=0
if [ -d /tmp ]; then
    while IFS= read -r -d '' tmp_file; do
        rm -f "$tmp_file" 2>/dev/null && TMP_DELETED=$((TMP_DELETED + 1))
    done < <(find /tmp -maxdepth 1 -name 'issue-*' -mmin +1440 -print0 2>/dev/null)
fi

# 結果を出力（削除情報 + 健全性チェック）
SUMMARY=""
if [ "$REMOVED_COUNT" -gt 0 ]; then
    SUMMARY="worktree ${REMOVED_COUNT}件を自動削除（マージ済みまたはクローズ済み）: ${REMOVED_NAMES} | "
fi
if [ "$TMP_DELETED" -gt 0 ]; then
    SUMMARY="${SUMMARY}/tmp/issue-* ファイル ${TMP_DELETED}件を削除（24時間以上前） | "
fi
if [ "$PROBLEM_COUNT" -gt 0 ]; then
    SUMMARY="${SUMMARY}Worktree health: ${PROBLEM_COUNT} issues found. ${PROBLEMS}Fix before starting new issues."
fi

if [ -n "$SUMMARY" ]; then
    if command -v jq &> /dev/null; then
        JSON=$(jq -n --arg msg "$SUMMARY" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}')
        echo "$JSON"
    else
        SAFE_MSG=$(printf '%s' "$SUMMARY" | tr -d '"\\' | tr -d '\n\r\t')
        echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"${SAFE_MSG}\"}}"
    fi
fi

exit 0
