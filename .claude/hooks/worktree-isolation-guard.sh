#!/bin/bash
# mainブランチのエージェントが .worktrees/ 内のファイルにアクセスすることをブロック
# mainからworktreeへの一方向のみブロック。worktree間のアクセスは制限しない。
# PreToolUse (Read, Grep, Glob, Edit, Write) で実行される

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null) || true

if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" != "main" ]; then
  exit 0
fi

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd 2>/dev/null) || exit 0
WORKTREES_PREFIX="${REPO_ROOT}/.worktrees/"

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" == "${WORKTREES_PREFIX}"* ]]; then
  echo "DENY: mainブランチのエージェントは .worktrees/ 内のファイルにアクセスできません。" >&2
  echo "  対象: $FILE_PATH" >&2
  echo "  mainエージェントはmainブランチのファイルのみ参照してください。" >&2
  exit 2
fi
