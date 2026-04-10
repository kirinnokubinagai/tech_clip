#!/usr/bin/env bash
# poll-pr-review.sh
# PR のレビュー結果をポーリングし、結果を stdout に出力する
#
# 使い方:
#   bash scripts/poll-pr-review.sh <pr-number>
#
# 終了コード:
#   0: APPROVED
#   1: CHANGES_REQUESTED
#   2: TIMEOUT

PR_NUMBER="${1:-}"

if [[ -z "${PR_NUMBER}" ]]; then
  echo "usage: scripts/poll-pr-review.sh <pr-number>" >&2
  exit 1
fi

if [[ ! "${PR_NUMBER}" =~ ^[0-9]+$ ]]; then
  echo "error: pr-number は数値で指定してください: ${PR_NUMBER}" >&2
  exit 1
fi

# タイムアウト秒数（30分）
TIMEOUT_SECONDS=1800
# ポーリング間隔（秒）
POLL_INTERVAL_SECONDS=60

elapsed=0

while true; do
  review_json=$(gh pr view "${PR_NUMBER}" --json reviewDecision,reviews 2>/dev/null)
  review_decision=$(echo "${review_json}" | grep -o '"reviewDecision":"[^"]*"' | grep -o '[^"]*"$' | tr -d '"')

  if [[ "${review_decision}" == "APPROVED" ]]; then
    echo "APPROVED"
    exit 0
  fi

  if [[ "${review_decision}" == "CHANGES_REQUESTED" ]]; then
    full_review=$(gh pr view "${PR_NUMBER}" --json reviews,comments,reviewRequests 2>/dev/null)
    echo "CHANGES_REQUESTED"
    echo ""
    echo "--- Review Content ---"
    echo "${full_review}"
    exit 1
  fi

  # reviewDecision が空または null の場合、COMMENTED のみのレビューを確認する
  if [[ -z "${review_decision}" || "${review_decision}" == "null" ]]; then
    has_commented=$(echo "${review_json}" | grep -o '"state":"COMMENTED"' | head -1)
    if [[ -n "${has_commented}" ]]; then
      full_review=$(gh pr view "${PR_NUMBER}" --json reviews,comments,reviewRequests 2>/dev/null)
      echo "CHANGES_REQUESTED"
      echo ""
      echo "--- Review Content ---"
      echo "${full_review}"
      exit 1
    fi
  fi

  # タイムアウトチェック
  if [[ "${elapsed}" -ge "${TIMEOUT_SECONDS}" ]]; then
    echo "TIMEOUT"
    exit 2
  fi

  minutes_elapsed=$((elapsed / 60))
  minutes_total=$((TIMEOUT_SECONDS / 60))
  echo "PENDING (${minutes_elapsed}/${minutes_total} min)" >&2

  sleep "${POLL_INTERVAL_SECONDS}"
  elapsed=$((elapsed + POLL_INTERVAL_SECONDS))
done
