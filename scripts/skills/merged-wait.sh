#!/usr/bin/env bash
# PR マージ待機スクリプト（最大 30 分ポーリング）
# 使用方法: PR_NUMBER=<n> bash scripts/skills/merged-wait.sh
# 終了コード: 0=MERGED, 1=CLOSED_WITHOUT_MERGE, 2=TIMEOUT(30分)
set -uo pipefail

PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"

MAX_ATTEMPTS=60
for i in $(seq 1 $MAX_ATTEMPTS); do
  PR_STATE=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
  if [ "$PR_STATE" = "MERGED" ]; then
    echo "MERGED"
    exit 0
  fi
  if [ "$PR_STATE" = "CLOSED" ]; then
    echo "CLOSED_WITHOUT_MERGE"
    exit 1
  fi
  sleep 30
done

PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || echo "PR #$PR_NUMBER")
echo "TIMEOUT:url=$PR_URL"
exit 2
