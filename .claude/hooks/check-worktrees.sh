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

# git worktree list で全worktreeを取得（main以外）
WORKTREE_PATHS=$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2)

if [ -z "$WORKTREE_PATHS" ]; then
    exit 0
fi

# リポジトリルートとworktreeベースディレクトリを取得
REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd)
WORKTREE_BASE=$(dirname "$REPO_ROOT")
EXPECTED_PREFIX="${WORKTREE_BASE}/"

# origin/main を最新化
git fetch origin main --quiet 2>/dev/null || true

# Pass 1: マージ済みworktreeを自動削除
REMOVED_COUNT=0
REMOVED_NAMES=""
while IFS= read -r wt_path; do
    [ -z "$wt_path" ] && continue
    [ -d "$wt_path" ] || continue

    # WORKTREE_BASE直下でない（ネストworktree・不正パス）はPass 2に任せる
    [[ "$wt_path" != "${EXPECTED_PREFIX}"* ]] && continue
    [[ "$wt_path" == "${REPO_ROOT}" || "$wt_path" == "${REPO_ROOT}/"* ]] && continue

    wt_head=$(git -C "$wt_path" rev-parse HEAD 2>/dev/null) || continue

    # HEADがorigin/mainの祖先でなければスキップ（未マージ）
    git -C "$REPO_ROOT" merge-base --is-ancestor "$wt_head" origin/main 2>/dev/null || continue

    # 未コミットの変更がある場合はスキップ
    DIRTY=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??' | head -1)
    [ -n "$DIRTY" ] && continue

    branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null)
    wt_name=$(basename "$wt_path")
    if git worktree remove "$wt_path" 2>/dev/null; then
        if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
            git branch -D "$branch" 2>/dev/null || true
        fi
        REMOVED_COUNT=$((REMOVED_COUNT + 1))
        REMOVED_NAMES="${REMOVED_NAMES:+${REMOVED_NAMES}, }${wt_name}"
    fi
done <<< "$WORKTREE_PATHS"

# Pass 2: 残りのworktreeの健全性チェック（削除後に再取得）
WORKTREE_PATHS=$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2)

while IFS= read -r wt_path; do
    [ -z "$wt_path" ] && continue
    [ -d "$wt_path" ] || continue

    wt_name=$(basename "$wt_path")

    # ネストworktree検出: REPO_ROOT配下にworktreeが作成されている
    if [[ "$wt_path" == "${REPO_ROOT}/"* ]]; then
        PROBLEMS="${PROBLEMS}[ネスト] ${wt_name}: REPO_ROOT内部にworktreeが作成されている -> git worktree remove --force ${wt_path} で除去し ${WORKTREE_BASE}/ 直下に再作成 | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # worktreeパスの正当性チェック: WORKTREE_BASE 直下にあるか
    if [[ "$wt_path" != "${EXPECTED_PREFIX}"* ]]; then
        PROBLEMS="${PROBLEMS}[不正パス] ${wt_name}: ${WORKTREE_BASE}/ 配下にない不正なパス -> 正しいパスに再作成すること | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # WORKTREE_BASE直下であることを確認（サブディレクトリ内はNG）
    local_path="${wt_path#${EXPECTED_PREFIX}}"
    if [[ "$local_path" == */* ]]; then
        PROBLEMS="${PROBLEMS}[ネスト] ${wt_name}: ${WORKTREE_BASE}/ の直下ではなくネストしている -> ${WORKTREE_BASE}/ 直下に再作成 | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # git dir を解決（worktreeは .git ファイルで実際のgit dirを指す）
    GIT_DIR=""
    if [ -f "$wt_path/.git" ]; then
        GIT_DIR=$(sed 's/^gitdir: //' "$wt_path/.git")
        # 相対パスを絶対パスに解決
        if [[ "$GIT_DIR" != /* ]]; then
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
    BEHIND=$(git -C "$wt_path" rev-list --count "HEAD..origin/main" 2>/dev/null)
    if [ -n "$BEHIND" ] && [ "$BEHIND" -gt 0 ]; then
        PROBLEMS="${PROBLEMS}[遅れ] ${wt_name}: ${BEHIND} commits behind main -> git -C ${wt_path} merge origin/main | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
    fi
done <<< "$WORKTREE_PATHS"

# 結果を出力（削除情報 + 健全性チェック）
SUMMARY=""
if [ "$REMOVED_COUNT" -gt 0 ]; then
    SUMMARY="マージ済みworktree ${REMOVED_COUNT}件を自動削除: ${REMOVED_NAMES} | "
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
