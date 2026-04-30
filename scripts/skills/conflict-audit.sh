#!/usr/bin/env bash
# conflict 解消結果監査用 diff 取得スクリプト
# 使用方法: WORKTREE=<path> HASH=<commit-hash> bash scripts/skills/conflict-audit.sh
# 終了コード: 0=出力完了
set -euo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"
HASH="${HASH:?HASH is required}"

echo "=== commit stat ==="
git -C "$WORKTREE" log -1 --stat "$HASH"

echo ""
echo "=== diff ==="
git -C "$WORKTREE" show "$HASH"
