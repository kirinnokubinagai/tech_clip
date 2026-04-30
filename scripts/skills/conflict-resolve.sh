#!/usr/bin/env bash
# conflict 解消スクリプト（git fetch + merge origin/main）
# 使用方法: WORKTREE=<path> bash scripts/skills/conflict-resolve.sh
# 終了コード: 0=マージ成功, 1=コンフリクト残存, 2=その他エラー
set -uo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"

cd "$WORKTREE"
git fetch origin 2>&1

MERGE_OUTPUT=$(git merge origin/main 2>&1 || true)
if echo "$MERGE_OUTPUT" | grep -q "CONFLICT"; then
  CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "ファイル一覧取得失敗")
  echo "CONFLICT:files=$CONFLICT_FILES"
  exit 1
fi

if echo "$MERGE_OUTPUT" | grep -q "Already up to date\|up to date"; then
  echo "OK:already_uptodate"
  exit 0
fi

echo "OK:merged"
exit 0
