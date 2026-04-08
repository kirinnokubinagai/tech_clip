#!/bin/bash
# PostToolUse:Bash hook
# git push 後にレビューマーカーを削除（次回push時に再レビューを強制）

if ! command -v jq &> /dev/null; then
  exit 0
fi

COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -q "git push"; then
  exit 0
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$ROOT" ]; then
  exit 0
fi

MARKER="${ROOT}/.claude/.review-passed"
rm -f "$MARKER"

exit 0
