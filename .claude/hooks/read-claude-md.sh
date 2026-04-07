#!/usr/bin/env bash
# Stop hook: CLAUDE.md を再確認させる
set -euo pipefail

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"

if [[ -f "${CLAUDE_MD}" ]]; then
  echo "=== CLAUDE.md 再確認 ==="
  cat "${CLAUDE_MD}"
fi
