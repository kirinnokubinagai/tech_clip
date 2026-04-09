#!/bin/bash
# PostToolUse:Bash hook
# git worktree add 後に direnv allow と pnpm install --frozen-lockfile を促す

if ! command -v jq &> /dev/null; then
  exit 0
fi

COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -q "git worktree add"; then
  exit 0
fi

# worktree パスを抽出（git worktree add <path> の2番目の引数）
WTPATH=$(echo "$COMMAND" | sed 's/.*git worktree add //' | awk '{print $1}')

if [ -z "$WTPATH" ]; then
  exit 0
fi

# 絶対パスに変換（リポジトリルート基準）
if [[ "$WTPATH" != /* ]]; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  WTPATH="${REPO_ROOT}/$WTPATH"
fi

if [ ! -d "$WTPATH" ]; then
  exit 0
fi

# .envrc が存在する場合、direnv allow を促す
if [ -f "$WTPATH/.envrc" ]; then
  echo "⚠️ worktree 作成後は direnv allow が必要です"
  echo "次のコマンドを実行してください:"
  echo ""
  echo "  cd $WTPATH && direnv allow ."
  echo "  cd $WTPATH && direnv exec $WTPATH true"
  echo "  cd $WTPATH && direnv exec $WTPATH pnpm install --frozen-lockfile"
  echo ""
  echo "direnv allow が終わるまでは pnpm / direnv exec を実行しないでください"
fi

# node_modules が存在しない場合、警告を出す
if [ ! -d "$WTPATH/node_modules" ]; then
  echo "⚠️ worktree に node_modules がありません"
  echo "次のコマンドを実行してください:"
  echo ""
  if [ -f "$WTPATH/.envrc" ]; then
    echo "  cd $WTPATH && direnv exec $WTPATH pnpm install --frozen-lockfile"
  else
    echo "  cd $WTPATH && pnpm install --frozen-lockfile"
  fi
  echo ""
  echo "シンボリンクによる共有は禁止です（CLAUDE.md参照）"
fi
