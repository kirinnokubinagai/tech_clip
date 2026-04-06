#!/bin/bash
# mainブランチ上でのソースファイル編集をブロックするフック
# PreToolUse (Edit, Write) で実行される
# 注意: set -euo pipefail は使用しない（git失敗時にexit 1でセッション終了するため）

# GIT_DIR汚染を回避して正しいworktreeのブランチを取得
CURRENT_BRANCH=$(env -u GIT_DIR -u GIT_WORK_TREE git branch --show-current 2>/dev/null || echo "")

if [ -z "$CURRENT_BRANCH" ]; then
  exit 0
fi

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

  REPO_ROOT=$(cd "$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --git-common-dir 2>/dev/null)/.." && pwd)

  echo "DENY: mainブランチ上でのファイル編集は禁止されています" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "" >&2
  echo "worktreeを作成して作業してください:" >&2
  echo "  REPO_ROOT=${REPO_ROOT}" >&2
  echo "  git worktree add \"\${REPO_ROOT}/.worktrees/issue-N\" -b issue/N/short-desc" >&2
  echo "  cd \"\${REPO_ROOT}/.worktrees/issue-N\"" >&2
  echo "  pnpm install --frozen-lockfile" >&2
  exit 2
fi
