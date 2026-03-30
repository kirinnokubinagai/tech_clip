#!/bin/bash
# PRマージ前のコンフリクト自動検出・自動merge・マージスクリプト
# Usage: scripts/safe-merge.sh <PR番号> [worktree_path]
set -euo pipefail

PR_NUMBER="${1:?PR番号を指定してください}"
WORKTREE_PATH="${2:-}"
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "kirinnokubinagai/tech_clip")
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

echo "=== PR #${PR_NUMBER} セーフマージ ==="

# 1. コンフリクトチェック
MERGEABLE=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeable --jq .mergeable)

if [ "$MERGEABLE" = "CONFLICTING" ]; then
  echo "コンフリクト検出。mainをmergeして解消..."

  if [ -z "$WORKTREE_PATH" ]; then
    BRANCH=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json headRefName --jq .headRefName)
    ISSUE_NUM="${BRANCH#*issue/}"
    ISSUE_NUM="${ISSUE_NUM%%/*}"
    WORKTREE_PATH="$ROOT/.worktrees/issue-$ISSUE_NUM"
  fi

  if [ ! -d "$WORKTREE_PATH" ]; then
    echo "ERROR: Worktree $WORKTREE_PATH が見つかりません"
    exit 1
  fi

  git -C "$WORKTREE_PATH" fetch origin main

  if ! git -C "$WORKTREE_PATH" merge origin/main --no-edit; then
    echo "ERROR: 自動merge失敗。手動でコンフリクト解消が必要です"
    git -C "$WORKTREE_PATH" merge --abort
    exit 1
  fi

  git -C "$WORKTREE_PATH" push
  echo "merge完了。再チェック..."
  sleep 5
fi

# 2. 再確認
MERGEABLE=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeable --jq .mergeable)
if [ "$MERGEABLE" = "CONFLICTING" ]; then
  echo "ERROR: rebase後もコンフリクトが残っています"
  exit 1
fi

# 3. マージ
gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --delete-branch
echo "=== PR #${PR_NUMBER} マージ完了 ==="
