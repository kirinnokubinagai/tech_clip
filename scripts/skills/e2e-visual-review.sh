#!/usr/bin/env bash
# PR E2E (Android) 視覚レビュースクリプト
# 使用方法: WORKTREE=<path> PR_NUMBER=<n> bash scripts/skills/e2e-visual-review.sh
# 終了コード: 0=PASS, 1=FAIL(理由をstdoutに出力), 2=run未発見(スキップ)
set -euo pipefail

PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"
WORKTREE="${WORKTREE:?WORKTREE is required}"

BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName' 2>/dev/null || echo "")
if [ -z "$BRANCH" ]; then
  echo "SKIP:pr_not_found"
  exit 2
fi

RUN_JSON=$(gh run list \
  --workflow=pr-e2e-android.yml \
  --branch="$BRANCH" \
  --limit 1 \
  --json status,conclusion,databaseId 2>/dev/null || echo "[]")

RUN_ID=$(echo "$RUN_JSON" | jq -r '.[0].databaseId // empty')
if [ -z "$RUN_ID" ]; then
  echo "SKIP:no_e2e_run"
  exit 2
fi

RUN_STATUS=$(echo "$RUN_JSON" | jq -r '.[0].status')
RUN_CONCLUSION=$(echo "$RUN_JSON" | jq -r '.[0].conclusion // empty')

# in_progress の場合はポーリング（最大 45 分）
MAX_WAIT=90
WAITED=0
while [ "$RUN_STATUS" = "in_progress" ] || [ "$RUN_STATUS" = "queued" ]; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "TIMEOUT:e2e_run_still_running:run_id=$RUN_ID"
    exit 1
  fi
  sleep 30
  WAITED=$((WAITED + 1))
  RUN_JSON=$(gh run list --workflow=pr-e2e-android.yml --branch="$BRANCH" --limit 1 --json status,conclusion,databaseId 2>/dev/null || echo "[]")
  RUN_STATUS=$(echo "$RUN_JSON" | jq -r '.[0].status')
  RUN_CONCLUSION=$(echo "$RUN_JSON" | jq -r '.[0].conclusion // empty')
done

TMP_DIR="$WORKTREE/.claude/tmp"
mkdir -p "$TMP_DIR/screenshots" "$TMP_DIR/junit"

if [ "$RUN_CONCLUSION" = "failure" ]; then
  gh run download "$RUN_ID" -n pr-e2e-junit -D "$TMP_DIR/junit/" 2>/dev/null || true
  FAILURES=$(find "$TMP_DIR/junit" -name "*.xml" -exec grep -h 'testcase.*failure\|<failure' {} \; 2>/dev/null | head -20 || echo "詳細取得失敗")
  echo "FAIL:e2e_failed:run_id=$RUN_ID:details=$FAILURES"
  exit 1
fi

if [ "$RUN_CONCLUSION" = "success" ]; then
  gh run download "$RUN_ID" -n pr-e2e-screenshots -D "$TMP_DIR/screenshots/" 2>/dev/null || true
  gh run download "$RUN_ID" -n pr-e2e-junit -D "$TMP_DIR/junit/" 2>/dev/null || true
  # スクリーンショット一覧を出力（agent が Read ツールで確認する）
  find "$TMP_DIR/screenshots" -name "*.png" 2>/dev/null | sort
  echo "ARTIFACTS_READY:dir=$TMP_DIR"
  exit 0
fi

echo "SKIP:unknown_conclusion=$RUN_CONCLUSION"
exit 2
