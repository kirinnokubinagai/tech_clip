#!/usr/bin/env bash
# Stop hook: CLAUDE.md の内容を additionalContext として返す

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd 2>/dev/null) || exit 0
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"

if [[ ! -f "${CLAUDE_MD}" ]]; then
  exit 0
fi

if ! command -v python3 &>/dev/null; then
  exit 0
fi

MAX_SIZE_BYTES=51200
file_size=$(wc -c < "${CLAUDE_MD}" 2>/dev/null || echo 0)
if [ "$file_size" -gt "$MAX_SIZE_BYTES" ]; then
  exit 0
fi

ESCAPED=$(python3 -c 'import sys,json; print(json.dumps(open(sys.argv[1]).read()))' "${CLAUDE_MD}" 2>/dev/null) || exit 0
echo "{\"hookSpecificOutput\":{\"hookEventName\":\"Stop\",\"additionalContext\":${ESCAPED}}}"
