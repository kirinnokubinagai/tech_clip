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
  echo "使い方: bash scripts/poll-pr-review.sh <PR番号>" >&2
  exit 1
fi

if [[ ! "${PR_NUMBER}" =~ ^[0-9]+$ ]]; then
  echo "エラー: PR番号は数値で指定してください: ${PR_NUMBER}" >&2
  exit 1
fi

# タイムアウト秒数（デフォルト: 30分）
TIMEOUT_SECONDS="${POLL_PR_REVIEW_TIMEOUT_SECONDS:-1800}"
# ポーリング間隔（デフォルト: 60秒）
POLL_INTERVAL_SECONDS="${POLL_PR_REVIEW_INTERVAL_SECONDS:-60}"

# 中断シグナルを受けたらクリーンに終了する
trap 'echo "INTERRUPTED" >&2; exit 130' INT TERM

elapsed=0

while (( elapsed < TIMEOUT_SECONDS )); do
  gh_output=$(gh pr view "${PR_NUMBER}" --json reviewDecision --jq '.reviewDecision // ""' 2>&1) || {
    echo "WARN: gh pr view 失敗（認証失効・ネットワーク断の可能性）: ${gh_output}" >&2
    gh_output=""
  }
  review_decision="${gh_output}"

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
  # 「🔄 Request Changes」または明示的な CHANGES_REQUESTED マーカーを含むコメントのみ対象
  # 誤検知防止のため "Request Changes" 単独は除外し、🔄 と組み合わせた場合のみ対象とする
  changes_comment_count=$(gh pr view "${PR_NUMBER}" --json comments --jq '
    [.comments[] | select(.body | test("🔄.*Request Changes|CHANGES_REQUESTED"; "i"))] | length
  ' 2>/dev/null || echo "0")

  if [[ "${changes_comment_count}" -gt 0 ]]; then
    comment_content=$(gh pr view "${PR_NUMBER}" --json comments --jq '
      [.comments[] | select(.body | test("🔄.*Request Changes|CHANGES_REQUESTED"; "i"))]
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
  # 誤検知防止のため特定のフレーズのみ対象とする:
  #   "全件 PASS" / "全件PASS": レビュアーエージェントの PASS 宣言
  #   "✅.*PASS": CI/レビュー結果の ✅ + PASS
  #   "LGTM": 標準的な承認表現
  #   "Approve 相当": Claude bot の承認コメントフレーズ
  #   "マージ可能": Claude bot の承認判定フレーズ
  #   "指摘[^0-9]?0[^0-9]": 「指摘0件」のような確定0件表現（10件等との誤検知防止）
  approve_comment_count=$(gh pr view "${PR_NUMBER}" --json comments --jq '
    [.comments[] | select(.body | test("全件 ?PASS|LGTM|Approve 相当|マージ可能|✅.*PASS|指摘[^0-9]?0[^0-9]"; "i"))] | length
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
