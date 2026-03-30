#!/bin/bash
# mainブランチ上でのソースファイル編集をブロックするフック
# PreToolUse (Edit, Write) で実行される
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$ROOT" ]; then
  exit 0
fi

CURRENT_BRANCH=$(git -C "$ROOT" branch --show-current 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" = "main" ]; then
  TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

  if [ -z "$FILE_PATH" ]; then
    exit 0
  fi

  # .claude/ 配下の設定ファイルは許可（hooks, plans等）
  if echo "$FILE_PATH" | grep -q "/.claude/"; then
    exit 0
  fi

  echo "DENY: mainブランチ上でのファイル編集は禁止されています。worktreeを作成してください。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "  現在のブランチ: main" >&2
  exit 2
fi
