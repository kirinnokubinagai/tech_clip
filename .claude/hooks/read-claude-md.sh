#!/usr/bin/env bash
# Stop hook: CLAUDE.md の内容を additionalContext として返す
set -euo pipefail

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"

if [[ -f "${CLAUDE_MD}" ]]; then
  ESCAPED=$(python3 -c 'import sys,json; print(json.dumps(open(sys.argv[1]).read()))' "${CLAUDE_MD}")
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"Stop\",\"additionalContext\":${ESCAPED}}}"
fi
