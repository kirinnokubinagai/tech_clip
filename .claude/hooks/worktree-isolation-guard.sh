#!/bin/bash
# mainブランチのエージェントが .worktrees/ 内のファイルにアクセスすることをブロック
# PreToolUse (Read, Grep, Glob, Edit, Write) で実行される
set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" != "main" ]; then
  exit 0
fi

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"pattern"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"pattern"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if echo "$FILE_PATH" | grep -q '\.worktrees/'; then
  echo "DENY: mainブランチのエージェントは .worktrees/ 内のファイルにアクセスできません。" >&2
  echo "  対象: $FILE_PATH" >&2
  echo "  mainエージェントはmainブランチのファイルのみ参照してください。" >&2
  exit 2
fi
