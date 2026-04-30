#!/usr/bin/env bash
# polling state ファイル作成スクリプト
# 使用方法: WORKTREE=<path> ISSUE_NUMBER=<n> PR_NUMBER=<n> AGENT_NAME=<name> bash scripts/skills/polling-state-create.sh
# 終了コード: 0=成功
set -euo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"
ISSUE_NUMBER="${ISSUE_NUMBER:?ISSUE_NUMBER is required}"
PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"
AGENT_NAME="${AGENT_NAME:?AGENT_NAME is required}"

PUSH_SHA=$(git -C "$WORKTREE" rev-parse HEAD)
POLLING_DIR="$WORKTREE/.claude/polling"
mkdir -p "$POLLING_DIR"

cat > "$POLLING_DIR/pr-${PR_NUMBER}.json" << JSON_EOF
{
  "pr_number": ${PR_NUMBER},
  "push_sha": "${PUSH_SHA}",
  "issue_number": "${ISSUE_NUMBER}",
  "agent_name": "${AGENT_NAME}",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON_EOF

echo "OK:state_file=$POLLING_DIR/pr-${PR_NUMBER}.json"
