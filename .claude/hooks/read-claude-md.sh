#!/usr/bin/env bash
# Stop hook: CLAUDE.md を再確認させる

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"

if [[ -f "${CLAUDE_MD}" ]]; then
  echo "=== CLAUDE.md 再確認 ==="
  cat "${CLAUDE_MD}" || true
fi
