#!/bin/bash
# PreToolUse:Edit/Write hook: orchestratorによるソースファイルの直接編集をブロック
#
# orchestration/config ファイル（.claude/hooks/, .claude/skills/, .claude/agents/,
# CLAUDE.md, flake.nix, .gitignore 等）は許可する。
# ソースファイル（apps/, packages/, tests/ 配下）は coder agent 経由を強制する。

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

if command -v jq &> /dev/null; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# orchestration/config ファイルかどうかを判定する
is_orchestration_file() {
  local path="$1"

  echo "$path" | grep -qE "(^|/)\.claude/(hooks|skills|agents|rules|plans)/" && return 0
  echo "$path" | grep -qE "(^|/)\.claude/settings\.json$" && return 0
  echo "$path" | grep -qE "(^|/)CLAUDE\.md$" && return 0
  echo "$path" | grep -qE "(^|/)AGENTS\.md$" && return 0
  echo "$path" | grep -qE "(^|/)flake\.nix$" && return 0
  echo "$path" | grep -qE "(^|/)\.gitignore$" && return 0
  echo "$path" | grep -qE "(^|/)\.env\.example$" && return 0
  echo "$path" | grep -qE "(^|/)turbo\.json$" && return 0
  # ルートの package.json のみ許可（apps/api/package.json 等のサブパッケージは除外）
  echo "$path" | grep -qE "^(\./)?package\.json$" && return 0
  echo "$path" | grep -qE "(^|/)pnpm-workspace\.yaml$" && return 0

  return 1
}

# ソースファイルかどうかを判定する（ブロック対象）
is_source_file() {
  local path="$1"

  echo "$path" | grep -qE "(^|/)apps/" && return 0
  echo "$path" | grep -qE "(^|/)packages/" && return 0
  echo "$path" | grep -qE "(^|/)tests/" && return 0

  return 1
}

if is_orchestration_file "$FILE_PATH"; then
  exit 0
fi

if is_source_file "$FILE_PATH"; then
  echo "DENY: orchestratorによるソースファイルの直接編集は禁止されています。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "  coder agent を使って編集してください。" >&2
  echo "  例: Agent(coder) でタスクを委譲する" >&2
  exit 2
fi

exit 0
