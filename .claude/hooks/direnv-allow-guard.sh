#!/bin/bash
# PreToolUse:Bash hook
# .envrc を使う worktree で direnv allow 前の env 依存コマンド実行をブロックする

if ! command -v jq &> /dev/null; then
  exit 0
fi

if ! command -v direnv &> /dev/null; then
  exit 0
fi

COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

requires_direnv_allow() {
  local cmd="$1"

  echo "$cmd" | grep -qE '(^|[[:space:];|&])(direnv[[:space:]]+exec|pnpm|node|npm|npx|turbo|biome|vitest|jest|wrangler|drizzle-kit|zap|maestro|expo|tsx|tsc)([[:space:];|&]|$)'
}

allows_direnv() {
  local cmd="$1"

  echo "$cmd" | grep -qE '(^|[[:space:];|&])direnv[[:space:]]+allow([[:space:];|&]|$)'
}

if allows_direnv "$COMMAND"; then
  exit 0
fi

if ! requires_direnv_allow "$COMMAND"; then
  exit 0
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$ROOT" ]; then
  exit 0
fi

if [ ! -f "$ROOT/.envrc" ]; then
  exit 0
fi

if (cd "$ROOT" && direnv exec "$ROOT" true > /dev/null 2>&1); then
  exit 0
fi

echo "DENY: direnv allow が未完了のため env 依存コマンドを実行できません。" >&2
echo "  対象worktree: $ROOT" >&2
echo "  先に実行: cd \"$ROOT\" && direnv allow ." >&2
echo "  その後:   cd \"$ROOT\" && direnv exec \"$ROOT\" <command>" >&2
exit 2
