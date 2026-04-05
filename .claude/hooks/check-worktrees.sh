#!/bin/bash
# check-worktrees.sh
# SessionStart hook: 全worktreeの健全性をチェック
#
# 検出する問題:
# 1. 未コミットの変更（modified/staged files）
# 2. リベース/マージ途中の状態
# 3. mainから遅れているブランチ

PROBLEMS=""
PROBLEM_COUNT=0

# git worktree list で全worktreeを取得（main以外）
WORKTREE_PATHS=$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2)

if [ -z "$WORKTREE_PATHS" ]; then
    exit 0
fi

# リポジトリルートを取得
REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd)
EXPECTED_PREFIX="${REPO_ROOT}/.worktrees/"

for wt_path in $WORKTREE_PATHS; do
    [ -d "$wt_path" ] || continue

    wt_name=$(basename "$wt_path")

    # ネストworktree検出: .worktrees/ 配下にさらに .worktrees/ があるパス
    if echo "$wt_path" | grep -qE '\.worktrees/[^/]+/\.worktrees/'; then
        PROBLEMS="${PROBLEMS}[NESTED] ${wt_name}: worktreeがネストしている -> git worktree remove --force ${wt_path} で除去し ${EXPECTED_PREFIX} 直下に再作成 | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # git dir を解決（worktreeは .git ファイルで実際のgit dirを指す）
    GIT_DIR=""
    if [ -f "$wt_path/.git" ]; then
        GIT_DIR=$(cat "$wt_path/.git" | sed 's/^gitdir: //')
    elif [ -d "$wt_path/.git" ]; then
        GIT_DIR="$wt_path/.git"
    fi

    # 1. リベース/マージ途中チェック（ファイルベース、ロケール非依存）
    if [ -n "$GIT_DIR" ]; then
        if [ -d "$GIT_DIR/rebase-merge" ] || [ -d "$GIT_DIR/rebase-apply" ]; then
            PROBLEMS="${PROBLEMS}[REBASE] ${wt_name}: rebase途中 -> git -C ${wt_path} rebase --continue or --abort | "
            PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
            continue
        fi
        if [ -f "$GIT_DIR/MERGE_HEAD" ]; then
            PROBLEMS="${PROBLEMS}[MERGE] ${wt_name}: merge途中 -> git -C ${wt_path} merge --continue or --abort | "
            PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
            continue
        fi
    fi

    # 2. 未コミットの変更チェック
    DIRTY=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??' | head -1)
    if [ -n "$DIRTY" ]; then
        DIRTY_COUNT=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')
        PROBLEMS="${PROBLEMS}[UNCOMMITTED] ${wt_name}: ${DIRTY_COUNT}files -> git -C ${wt_path} add -A && git commit | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
    fi

    # 3. mainから遅れているかチェック
    BEHIND=$(git -C "$wt_path" rev-list --count "HEAD..origin/main" 2>/dev/null)
    if [ -n "$BEHIND" ] && [ "$BEHIND" -gt 0 ]; then
        PROBLEMS="${PROBLEMS}[BEHIND] ${wt_name}: ${BEHIND} commits behind main -> git -C ${wt_path} rebase origin/main | "
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
    fi
done

if [ "$PROBLEM_COUNT" -gt 0 ]; then
    # jqがあればjqで安全にJSON生成、なければシンプルなASCII出力
    MSG="Worktree health: ${PROBLEM_COUNT} issues found. ${PROBLEMS}Fix before starting new issues."
    if command -v jq &> /dev/null; then
        JSON=$(jq -n --arg msg "$MSG" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}')
        echo "$JSON"
    else
        # jqなしフォールバック: ASCII文字のみ使用でJSON安全
        SAFE_MSG=$(printf '%s' "$MSG" | tr -d '"\\')
        echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"${SAFE_MSG}\"}}"
    fi
fi

exit 0
