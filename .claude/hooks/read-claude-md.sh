#!/bin/bash
# PreToolUse hook: 各ツール実行前に CLAUDE.md を注入
set -euo pipefail

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd 2>/dev/null) || exit 0
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"

if [[ -f "$CLAUDE_MD" ]]; then
  # additionalContext として AI に読まれる
  CONTENT=$(<"$CLAUDE_MD")
  jq -n --arg content "$CONTENT" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":$content}}'
fi

exit 0
