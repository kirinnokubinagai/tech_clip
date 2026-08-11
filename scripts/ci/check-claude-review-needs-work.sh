#!/usr/bin/env bash
# scripts/ci/check-claude-review-needs-work.sh
# claude-review step の outcome と PR ラベルから needs_work を判定する fail-closed 実装。
#
# 入力 (env):
#   EVENT_NAME      GitHub event 名（pull_request 以外なら needs_work=false）
#   REVIEW_OUTCOME  steps.review.outcome（success / failure / cancelled / skipped）
#   PR_NUMBER       PR 番号
#   REPO            owner/repo
#   GH_TOKEN        gh CLI 用トークン
#   GITHUB_OUTPUT   GitHub Actions 出力ファイル（任意。なければ stdout のみ）
#
# 出力:
#   needs_work=true|false を $GITHUB_OUTPUT へ append。stdout にも echo。
set -euo pipefail

emit() {
  echo "needs_work=$1"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "needs_work=$1" >> "$GITHUB_OUTPUT"
  fi
}

# push イベント時は既存挙動維持（PR でない）
if [ "${EVENT_NAME:-}" != "pull_request" ]; then
  emit false
  exit 0
fi

# fail-closed 1: review step が success 以外なら needs_work=true
if [ "${REVIEW_OUTCOME:-}" != "success" ]; then
  echo "claude-review step outcome=${REVIEW_OUTCOME:-unset} → fail-closed (needs_work=true)" >&2
  emit true
  exit 0
fi

# review step は success。ラベルで合否判定。
LABELS=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json labels --jq '.labels[].name' 2>/dev/null || echo "__GH_FAILED__")

# fail-closed 2: gh pr view 自体が失敗した場合は needs_work=true
if [ "$LABELS" = "__GH_FAILED__" ]; then
  echo "gh pr view failed → fail-closed (needs_work=true)" >&2
  emit true
  exit 0
fi

# NEEDS WORK 優先（PASS と同時に付いていても NEEDS WORK 採用）
if echo "$LABELS" | grep -q "AI Review: NEEDS WORK"; then
  emit true
  exit 0
fi

# PASS ラベルが付いていれば PASS
if echo "$LABELS" | grep -q "AI Review: PASS"; then
  emit false
  exit 0
fi

# fail-closed 3: review step success だがラベルが何も付いていない（異常ケース）
echo "review step success but no AI Review label found → fail-closed" >&2
emit true
