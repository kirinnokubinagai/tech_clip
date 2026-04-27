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

# review marker を必ず削除（次回 push 時に再レビューを強制）
rm -f "${ROOT}/.claude/.review-passed"

# e2e marker は SHA が remote と一致していれば削除する。
# 不一致 (push できなかった等) の場合は marker を残してデバッグ可能にする。
E2E_MARKER="${ROOT}/.claude/.e2e-passed"
if [ -f "$E2E_MARKER" ]; then
  CURRENT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
  MARKER_SHA=$(tr -d '[:space:]' < "$E2E_MARKER" 2>/dev/null || echo "")
  if [ -n "$CURRENT_SHA" ] && [ "$CURRENT_SHA" = "$MARKER_SHA" ]; then
    rm -f "$E2E_MARKER"
  fi
fi

exit 0
