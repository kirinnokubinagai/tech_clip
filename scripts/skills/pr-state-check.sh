#!/usr/bin/env bash
# PR 状態調査スクリプト（orchestrator 用 5 ステップ調査）
# 使用方法: PR_NUMBER=<n> REPO=<owner/repo> bash scripts/skills/pr-state-check.sh
# 終了コード: 0=調査完了(結果はstdout)
set -uo pipefail

PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"
REPO="${REPO:-}"

REPO_FLAG=""
if [ -n "$REPO" ]; then
  REPO_FLAG="--repo $REPO"
fi

echo "=== Step 1: PR 基本状態 ==="
gh pr view "$PR_NUMBER" $REPO_FLAG \
  --json state,mergeable,mergeStateStatus,reviewDecision,reviews,statusCheckRollup 2>/dev/null || echo "取得失敗"

echo ""
echo "=== Step 2: PR コメント（bot comment 含む） ==="
gh pr view "$PR_NUMBER" $REPO_FLAG --comments 2>/dev/null | tail -100 || echo "取得失敗"

echo ""
echo "=== Step 3: CI checks ==="
gh pr checks "$PR_NUMBER" $REPO_FLAG 2>/dev/null || echo "取得失敗"

echo ""
echo "=== Step 4: Rulesets ==="
if [ -n "$REPO" ]; then
  gh api "repos/${REPO}/rulesets" 2>/dev/null | jq -r '.[].name' || echo "取得失敗"
else
  REPO_PATH=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")
  if [ -n "$REPO_PATH" ]; then
    gh api "repos/${REPO_PATH}/rulesets" 2>/dev/null | jq -r '.[].name' || echo "取得失敗"
  fi
fi

echo ""
echo "=== Step 5: 判定ポイントまとめ ==="
gh pr view "$PR_NUMBER" $REPO_FLAG \
  --json mergeStateStatus,reviewDecision \
  --jq '"mergeStateStatus: \(.mergeStateStatus)  reviewDecision: \(.reviewDecision)"' 2>/dev/null || echo "取得失敗"
