#!/bin/bash
# mainブランチのエージェントが兄弟worktree内のファイルにアクセスすることをブロック
# mainからworktreeへの一方向のみブロック。worktree間のアクセスは制限しない。
# PreToolUse (Read, Grep, Glob, Edit, Write) で実行される

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null) || true

if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" != "main" ]; then
  exit 0
fi

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd 2>/dev/null) || exit 0
WORKTREE_BASE=$(dirname "$REPO_ROOT")

TOOL_INPUT=$(cat)

if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
else
  # 注意: 新しい tool_input.file_path 構造でも grep がネストを無視して "file_path" にマッチするため動作する。将来のフォーマット変更で壊れる可能性あり
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  if [ -z "$FILE_PATH" ]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  fi
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# .claude/ 配下の設定ファイルはスキップ
if echo "$FILE_PATH" | grep -qE "(^|/)\.claude/"; then
  exit 0
fi

# WORKTREE_BASE配下かつREPO_ROOT配下でないファイルへのアクセスをブロック
if [[ "$FILE_PATH" == "${WORKTREE_BASE}/"* ]] && [[ "$FILE_PATH" != "${REPO_ROOT}/"* ]]; then
  echo "DENY: mainブランチのエージェントは兄弟worktree内のファイルにアクセスできません。" >&2
  echo "  対象: $FILE_PATH" >&2
  echo "  mainエージェントはmainブランチのファイルのみ参照してください。" >&2
  exit 2
fi
