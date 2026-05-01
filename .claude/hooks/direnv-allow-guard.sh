#!/bin/bash
# PreToolUse:Bash hook
# direnv allow 未完了の worktree で env 依存コマンドの実行をブロック

command -v jq >/dev/null && command -v direnv >/dev/null || exit 0

# helper はこのスクリプトの位置基準で source（テストの fake repo でも壊れないように）
HOOK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LIB="${HOOK_DIR}/../../scripts/lib/worktree-init.sh"
[ -f "$LIB" ] || exit 0
# shellcheck source=../../scripts/lib/worktree-init.sh
source "$LIB"

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0

is_direnv_allow_command "$CMD" && exit 0
needs_direnv_allow "$CMD" || exit 0

REPO_ROOT=$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$REPO_ROOT/.envrc" ] || exit 0
direnv_ready "$REPO_ROOT" && exit 0

echo "DENY: direnv allow 未完了。先に: cd \"$REPO_ROOT\" && direnv allow ." >&2
exit 2
