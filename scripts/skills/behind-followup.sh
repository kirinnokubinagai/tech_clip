#!/usr/bin/env bash
# BEHIND 自動追従スクリプト
# 使用方法: WORKTREE=<path> ISSUE_NUMBER=<n> PR_NUMBER=<n> AGENT_NAME=<name> bash scripts/skills/behind-followup.sh
# 終了コード: 0=追従成功(polling state 更新済み), 1=DIRTY/CONFLICT, 2=その他
set -euo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"
ISSUE_NUMBER="${ISSUE_NUMBER:?ISSUE_NUMBER is required}"
PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"
AGENT_NAME="${AGENT_NAME:?AGENT_NAME is required}"

MERGE_STATE=$(gh pr view "$PR_NUMBER" --json mergeStateStatus --jq '.mergeStateStatus' 2>/dev/null || echo "")

if [ "$MERGE_STATE" = "BEHIND" ]; then
  git -C "$WORKTREE" fetch origin
  git -C "$WORKTREE" merge origin/main
  (cd "$WORKTREE" && bash scripts/push-verified.sh)

  NEW_SHA=$(git -C "$WORKTREE" rev-parse HEAD)
  POLLING_DIR="$WORKTREE/.claude/polling"
  cat > "$POLLING_DIR/pr-${PR_NUMBER}.json" << JSON_EOF
{
  "pr_number": ${PR_NUMBER},
  "push_sha": "${NEW_SHA}",
  "issue_number": "${ISSUE_NUMBER}",
  "agent_name": "${AGENT_NAME}",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON_EOF
  echo "OK:behind_resolved:new_sha=$NEW_SHA"
  exit 0
fi

if [ "$MERGE_STATE" = "DIRTY" ] || [ "$MERGE_STATE" = "CONFLICTING" ]; then
  echo "CONFLICT:merge_state=$MERGE_STATE"
  exit 1
fi

echo "OK:state=$MERGE_STATE"
exit 2
