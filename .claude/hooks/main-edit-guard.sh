#!/bin/bash
# mainブランチ上でのソースファイル編集をブロックするフック
# PreToolUse (Edit, Write) で実行される
set -euo pipefail

ROOT=$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$ROOT" ]; then
  exit 0
fi

CURRENT_BRANCH=$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$ROOT" branch --show-current 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" = "main" ]; then
  TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

  if [ -z "$FILE_PATH" ]; then
    exit 0
  fi

  # ソースコード以外は main 上での編集を許可
  # ブロック対象: apps/, packages/, tests/ 配下のみ（実装コード）
  IS_SOURCE=false
  if echo "$FILE_PATH" | grep -qE "(^|/)apps/"; then
    IS_SOURCE=true
  elif echo "$FILE_PATH" | grep -qE "(^|/)packages/"; then
    IS_SOURCE=true
  elif echo "$FILE_PATH" | grep -qE "(^|/)tests/"; then
    IS_SOURCE=true
  fi

  if [ "$IS_SOURCE" = false ]; then
    exit 0
  fi

  echo "DENY: mainブランチ上でのソースコード編集は禁止されています。worktreeを作成してください。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "  現在のブランチ: main" >&2
  echo "  ブロック対象: apps/, packages/, tests/ 配下" >&2
  exit 2
fi
