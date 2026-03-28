#!/bin/bash
# PR レビュー & マージスクリプト
# Usage: scripts/review-and-merge.sh <PR番号>
set -euo pipefail

PR_NUMBER="${1:?PR番号を指定してください}"
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "kirinnokubinagai/tech_clip")

echo "=== PR #${PR_NUMBER} マージ前チェック ==="

# 1. PR状態確認
STATE=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json state --jq .state)
if [ "$STATE" != "OPEN" ]; then
  echo "ERROR: PR #${PR_NUMBER} は ${STATE} です"
  exit 1
fi

# 2. レビュー済みか確認（GH review または PRコメント）
REVIEW_COUNT=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" --jq 'length' 2>/dev/null || echo "0")
COMMENT_COUNT=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" --jq 'length' 2>/dev/null || echo "0")

if [ "$REVIEW_COUNT" = "0" ] && [ "$COMMENT_COUNT" = "0" ]; then
  echo "ERROR: レビューがありません。先にcode-reviewを実行してください"
  exit 1
fi
echo "--- レビュー: ${REVIEW_COUNT}件（GH review）+ ${COMMENT_COUNT}件（コメント）確認 ---"

# 3. マージ可能か確認
MERGEABLE=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeable --jq .mergeable)
if [ "$MERGEABLE" = "CONFLICTING" ]; then
  echo "ERROR: コンフリクトがあります。scripts/safe-merge.sh を使ってください"
  exit 1
fi

# 4. CIチェック確認
echo "--- CIチェック確認中 ---"
if ! gh pr checks "$PR_NUMBER" --repo "$REPO" 2>&1; then
  echo "WARNING: CIチェックが未完了または失敗しています"
fi

# 5. マージ実行
echo "=== チェック完了。マージします ==="
gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --delete-branch

echo "=== PR #${PR_NUMBER} マージ完了 ==="
