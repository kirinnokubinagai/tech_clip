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

set -uo pipefail

PR_NUMBER="${1:-}"

if [[ -z "${PR_NUMBER}" ]]; then
  echo "usage: scripts/poll-pr-review.sh <pr-number>" >&2
  exit 1
fi

if [[ ! "${PR_NUMBER}" =~ ^[0-9]+$ ]]; then
  echo "error: pr-number は数値で指定してください: ${PR_NUMBER}" >&2
  exit 1
fi

# タイムアウト秒数（デフォルト: 30分）
TIMEOUT_SECONDS="${POLL_PR_REVIEW_TIMEOUT_SECONDS:-1800}"
# ポーリング間隔（デフォルト: 60秒）
POLL_INTERVAL_SECONDS="${POLL_PR_REVIEW_INTERVAL_SECONDS:-60}"

elapsed=0

while (( elapsed < TIMEOUT_SECONDS )); do
  review_decision=$(gh pr view "${PR_NUMBER}" --json reviewDecision --jq '.reviewDecision // ""' 2>/dev/null || true)

  if [[ "${review_decision}" == "APPROVED" ]]; then
    echo "APPROVED"
    exit 0
  fi

  if [[ "${review_decision}" == "CHANGES_REQUESTED" ]]; then
    review_content=$(gh pr view "${PR_NUMBER}" --json reviews --jq '
      .reviews
      | map(select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED"))
      | map("[" + .state + "] " + (.author.login // "unknown") + ":\n" + (.body // ""))
      | join("\n\n---\n\n")
    ' 2>/dev/null || true)
    echo "CHANGES_REQUESTED"
    echo ""
    echo "--- Review Content (formal review) ---"
    echo "${review_content}"
    exit 1
  fi

  # コメント形式のレビュー（Claude bot 等が PR comment で投稿する場合）も検出する
  # "Request Changes" または "🔄" を含むコメントを CHANGES_REQUESTED として扱う
  changes_comment_count=$(gh pr view "${PR_NUMBER}" --json comments --jq '
    [.comments[] | select(.body | test("Request Changes|🔄|CHANGES_REQUESTED"; "i"))] | length
  ' 2>/dev/null || echo "0")

  if [[ "${changes_comment_count}" -gt 0 ]]; then
    comment_content=$(gh pr view "${PR_NUMBER}" --json comments --jq '
      [.comments[] | select(.body | test("Request Changes|🔄|CHANGES_REQUESTED"; "i"))]
      | map("[@" + (.author.login // "unknown") + "]:\n" + .body)
      | join("\n\n---\n\n")
    ' 2>/dev/null || true)
    echo "CHANGES_REQUESTED"
    echo ""
    echo "--- Review Content (from comments) ---"
    echo "${comment_content}"
    exit 1
  fi

  # LGTM / Approve 系コメントも検出する
  # "Approve 相当"（Approved の前に d がないケース）やマージ可能判定も含む
  approve_comment_count=$(gh pr view "${PR_NUMBER}" --json comments --jq '
    [.comments[] | select(.body | test("✅.*PASS|全件 PASS|全件PASS|LGTM|Approved?|マージ可能|指摘.*0.*件|0.*件.*指摘"; "i"))] | length
  ' 2>/dev/null || echo "0")

  if [[ "${approve_comment_count}" -gt 0 ]] && [[ "${changes_comment_count}" -eq 0 ]]; then
    echo "APPROVED"
    exit 0
  fi

  minutes_elapsed=$(( elapsed / 60 ))
  minutes_total=$(( TIMEOUT_SECONDS / 60 ))
  echo "PENDING: レビュー待ち (${minutes_elapsed}/${minutes_total} 分経過)" >&2

  sleep "${POLL_INTERVAL_SECONDS}"
  elapsed=$(( elapsed + POLL_INTERVAL_SECONDS ))
done

echo "TIMEOUT"
exit 2
