#!/bin/bash
# PostToolUse:Bash hook
# `git worktree add` 直後、direnv allow / pnpm install が未完了なら警告

command -v jq >/dev/null || exit 0

HOOK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LIB="${HOOK_DIR}/../../scripts/lib/worktree-init.sh"
[ -f "$LIB" ] || exit 0
# shellcheck source=../../scripts/lib/worktree-init.sh
source "$LIB"

CMD=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0
echo "$CMD" | grep -q "git worktree add" || exit 0

# `git worktree add <path>` から path を抽出
WTPATH=$(echo "$CMD" | sed 's/.*git worktree add //' | awk '{print $1}')
[ -z "$WTPATH" ] && exit 0
if [[ "$WTPATH" != /* ]]; then
  REPO_ROOT=$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel 2>/dev/null || pwd)
  WTPATH="${REPO_ROOT}/$WTPATH"
fi
[ -d "$WTPATH" ] || exit 0

NEEDS_INIT=false
[ -f "$WTPATH/.envrc" ] && ! direnv_ready "$WTPATH" && NEEDS_INIT=true
[ ! -d "$WTPATH/node_modules" ] && NEEDS_INIT=true

if [ "$NEEDS_INIT" = "true" ]; then
  echo "⚠️ worktree 初期化が未完了です。次を実行してください:"
  print_init_commands "$WTPATH"
  echo "（推奨: 'bash scripts/create-worktree.sh <N> <desc>' を使うとこの初期化が自動化される）"
fi
