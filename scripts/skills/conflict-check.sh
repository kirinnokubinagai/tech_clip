#!/usr/bin/env bash
# コンフリクトチェックスクリプト
# 使用方法: WORKTREE=<path> ISSUE_NUMBER=<n> bash scripts/skills/conflict-check.sh
# 終了コード: 0=コンフリクトなし, 1=コンフリクトあり
set -euo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"
ISSUE_NUMBER="${ISSUE_NUMBER:?ISSUE_NUMBER is required}"

MAIN_WT=$(git -C "$WORKTREE" worktree list --porcelain | head -1 | sed 's/^worktree //')
TEAM_CONFIG="$MAIN_WT/.claude-user/teams/active-issues/config.json"

# C-0: analyst 存在確認
if [ -f "$TEAM_CONFIG" ] && command -v jq >/dev/null 2>&1; then
  ANALYST_EXISTS=$(jq -r --arg name "analyst-${ISSUE_NUMBER}" \
    '.members | map(select(.name == $name)) | length' "$TEAM_CONFIG")
  if [ "$ANALYST_EXISTS" = "0" ]; then
    echo "WARNING:analyst_missing:issue=$ISSUE_NUMBER"
  fi
fi

# C-1: 実装系エージェント多重チェック
if [ -f "$TEAM_CONFIG" ] && command -v jq >/dev/null 2>&1; then
  IMPL_COUNT=$(jq -r --arg n "${ISSUE_NUMBER}" \
    '[.members[] | select(.name | test("^(coder|infra-engineer|ui-designer)(-[a-zA-Z0-9-]+)?-") and endswith("-" + $n))] | length' \
    "$TEAM_CONFIG")
  if [ "$IMPL_COUNT" -gt 1 ]; then
    echo "WARNING:multiple_impl:count=$IMPL_COUNT:issue=$ISSUE_NUMBER"
  fi
fi

# origin/main とのコンフリクトテスト
cd "$WORKTREE"
git fetch origin main 2>/dev/null

MERGE_OUTPUT=$(git merge --no-commit --no-ff origin/main 2>&1 || true)
if echo "$MERGE_OUTPUT" | grep -q "CONFLICT"; then
  CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null \
    || echo "ファイル一覧取得失敗")
  git merge --abort 2>/dev/null || true
  echo "CONFLICT:files=$CONFLICT_FILES"
  exit 1
fi

git merge --abort 2>/dev/null || true
echo "OK:no_conflict"
exit 0
