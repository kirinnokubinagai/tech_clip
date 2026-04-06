#!/bin/bash
# mainブランチ上でのソースファイル編集をブロックするフック
# PreToolUse (Edit, Write) で実行される
# 注意: set -e は使用禁止（git失敗時にexit 1でセッションが終了するため）
# -u（未定義変数検出）と -o pipefail（パイプエラー検出）は有効にする
set -uo pipefail

# GIT_DIR汚染を回避してリポジトリルートとブランチ名を取得
# Claude CodeはGIT_DIR環境変数を設定するため、worktreeで実行しても
# mainブランチとして認識される誤検知が発生する。
# env -u GIT_DIR でGIT_DIRをアンセットしてから実行することで正しいブランチを取得する。
ROOT=$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$ROOT" ]; then
  exit 0
fi
CURRENT_BRANCH=$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$ROOT" branch --show-current 2>/dev/null || echo "")

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

  echo "DENY: mainブランチ上でのファイル編集は禁止されています。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "  現在のブランチ: main" >&2
  echo "" >&2
  echo "  対処方法:" >&2
  echo '    REPO_ROOT=$(cd "$(env -u GIT_DIR git rev-parse --git-common-dir)/.." && pwd)' >&2
  echo "    git worktree add \"\${REPO_ROOT}/.worktrees/issue-N\" -b issue/N/description" >&2
  exit 2
fi
