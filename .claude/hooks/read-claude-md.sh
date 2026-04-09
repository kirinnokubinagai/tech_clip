#!/usr/bin/env bash
# SessionStart hook: CLAUDE.md を additionalContext として再注入する

set -euo pipefail

REPO_ROOT=$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel 2>/dev/null || echo ".")
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"

if [[ ! -f "${CLAUDE_MD}" ]]; then
  exit 0
fi

CLAUDE_CONTENT=$(cat "${CLAUDE_MD}")
MESSAGE=$'=== CLAUDE.md 再確認 ===\n'"${CLAUDE_CONTENT}"

if command -v jq >/dev/null 2>&1; then
  jq -n --arg msg "${MESSAGE}" \
    '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}'
  exit 0
fi

SANITIZED_MESSAGE=$(printf '%s' "${MESSAGE}" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "${SANITIZED_MESSAGE}"
