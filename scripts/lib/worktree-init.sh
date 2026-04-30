#!/usr/bin/env bash
# worktree-init.sh: worktree の direnv / pnpm 初期化状態を確認するヘルパー
#
# 使い方:
#   source scripts/lib/worktree-init.sh
#   if needs_direnv_allow "$cmd"; then
#     # cmd は direnv 環境を要求するコマンド
#   fi
#   if direnv_ready "$worktree"; then ... fi

# direnv が必要なコマンドか判定
needs_direnv_allow() {
  echo "$1" | grep -qE '(^|[[:space:];|&])(direnv[[:space:]]+exec|pnpm|node|npm|npx|turbo|biome|vitest|jest|wrangler|drizzle-kit|zap|maestro|expo|tsx|tsc)([[:space:];|&]|$)'
}

# `direnv allow` 自体のコマンドか判定
is_direnv_allow_command() {
  echo "$1" | grep -qE '(^|[[:space:];|&])direnv[[:space:]]+allow([[:space:];|&]|$)'
}

# worktree の direnv が allow 済みか
direnv_ready() {
  local wt="$1"
  [ -f "$wt/.envrc" ] || return 0  # .envrc 不要なら ready
  command -v direnv >/dev/null 2>&1 || return 0  # direnv 不在なら ready とみなす
  (cd "$wt" && direnv exec "$wt" true >/dev/null 2>&1)
}

# worktree 初期化に必要なコマンドを stdout に出力
print_init_commands() {
  local wt="$1"
  if [ -f "$wt/.envrc" ]; then
    echo "  cd $wt && direnv allow ."
    echo "  cd $wt && direnv exec $wt pnpm install --frozen-lockfile"
  else
    echo "  cd $wt && pnpm install --frozen-lockfile"
  fi
}
