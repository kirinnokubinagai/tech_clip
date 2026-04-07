#!/bin/bash
# PreToolUse hook: 各ツール実行前に CLAUDE.md を注入
set -euo pipefail

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd 2>/dev/null) || exit 0
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"

if [[ -f "$CLAUDE_MD" ]]; then
  # systemReminder として AI に読まれる
  jq -n --arg content "$(<"$CLAUDE_MD")" '{"systemReminder": $content}'
fi

exit 0
