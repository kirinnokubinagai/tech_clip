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

for wt_path in $WORKTREE_PATHS; do
    [ -d "$wt_path" ] || continue

    wt_name=$(basename "$wt_path")

    # 1. リベース/マージ途中チェック（git statusで検出）
    REBASE_STATUS=$(git -C "$wt_path" status 2>/dev/null | head -1)
    if echo "$REBASE_STATUS" | grep -qiE '(rebase|merge)'; then
        PROBLEMS="${PROBLEMS}\n❌ ${wt_name}: リベース/マージ途中 → git -C ${wt_path} rebase --continue (または --abort)"
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
        continue
    fi

    # 2. 未コミットの変更チェック
    DIRTY=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??' | head -1)
    if [ -n "$DIRTY" ]; then
        DIRTY_COUNT=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')
        PROBLEMS="${PROBLEMS}\n⚠️  ${wt_name}: 未コミットの変更${DIRTY_COUNT}件 → git -C ${wt_path} add -A && git -C ${wt_path} commit"
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
    fi

    # 3. mainから遅れているかチェック
    BEHIND=$(git -C "$wt_path" rev-list --count "HEAD..origin/main" 2>/dev/null)
    if [ -n "$BEHIND" ] && [ "$BEHIND" -gt 0 ]; then
        PROBLEMS="${PROBLEMS}\n📌 ${wt_name}: mainから${BEHIND}コミット遅れ → git -C ${wt_path} rebase origin/main"
        PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
    fi
done

if [ "$PROBLEM_COUNT" -gt 0 ]; then
    MSG="🔍 Worktree健全性チェック: ${PROBLEM_COUNT}件の問題\n${PROBLEMS}\n\n上記を解決してから新しいIssueに着手してください。"
    ESCAPED_MSG=$(printf '%s' "$MSG" | sed 's/"/\\"/g' | tr '\n' ' ')
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"${ESCAPED_MSG}\"}}"
fi

exit 0
