#!/usr/bin/env bash
# lint → typecheck → self-check スクリプト（commit は agent が行う）
# 使用方法: WORKTREE=<path> bash scripts/skills/lint-commit-notify.sh
# 終了コード: 0=lint/typecheck通過, 1=lint失敗, 2=uncommitted変更あり
set -uo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"

# lint チェック
if ! (cd "$WORKTREE" && direnv exec "$WORKTREE" pnpm lint 2>&1); then
  echo "ERROR:lint_failed"
  exit 1
fi

# uncommitted changes 確認（commit 後の呼び出し想定）
UNCOMMITTED=$(git -C "$WORKTREE" status --porcelain)
if [ -n "$UNCOMMITTED" ]; then
  echo "ERROR:uncommitted_changes:$UNCOMMITTED"
  exit 2
fi

COMMIT_HASH=$(git -C "$WORKTREE" rev-parse HEAD)
echo "OK:hash=$COMMIT_HASH"
exit 0
