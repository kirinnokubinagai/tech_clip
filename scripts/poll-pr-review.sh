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

if [[ ! "${TIMEOUT_SECONDS}" =~ ^[0-9]+$ ]] || (( TIMEOUT_SECONDS <= 0 )); then
  echo "エラー: POLL_PR_REVIEW_TIMEOUT_SECONDS は正の整数で指定してください: ${TIMEOUT_SECONDS}" >&2
  exit 1
fi
if [[ ! "${POLL_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]] || (( POLL_INTERVAL_SECONDS <= 0 )); then
  echo "エラー: POLL_PR_REVIEW_INTERVAL_SECONDS は正の整数で指定してください: ${POLL_INTERVAL_SECONDS}" >&2
  exit 1
fi

# jq の存在確認（未インストール時はサイレントに誤動作するため事前チェック）
if ! command -v jq >/dev/null 2>&1; then
  echo "エラー: jq が必要です。nix develop で環境に入ってから実行してください。" >&2
  exit 1
fi

# 中断シグナルを受けたらクリーンに終了する
trap 'echo "INTERRUPTED" >&2; exit 130' INT TERM

elapsed=0

while (( elapsed < TIMEOUT_SECONDS )); do
  pr_data=$(gh pr view "${PR_NUMBER}" --json reviewDecision,reviews,comments 2>/dev/null || true)
  if [[ -z "${pr_data}" ]]; then
    echo "WARN: gh pr view 失敗（認証失効・ネットワーク断の可能性）" >&2
    remaining=$(( TIMEOUT_SECONDS - elapsed ))
    sleep_time=$(( POLL_INTERVAL_SECONDS < remaining ? POLL_INTERVAL_SECONDS : remaining ))
    sleep "${sleep_time}"
    elapsed=$(( elapsed + sleep_time ))
    continue
  fi

  review_decision=$(printf '%s' "${pr_data}" | jq -r '.reviewDecision // ""')

  # 正式レビューの APPROVED を最優先で処理する
  # ヒューマンレビュアーによる正式 Approve はコメント形式の bot 判定より優先する
  if [[ "${review_decision}" == "APPROVED" ]]; then
    echo "APPROVED"
    exit 0
  fi

  if [[ "${review_decision}" == "CHANGES_REQUESTED" ]]; then
    review_content=$(printf '%s' "${pr_data}" | jq -r '
      .reviews
      | map(select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED"))
      | map("[" + .state + "] " + (.author.login // "unknown") + ":\n" + (.body // ""))
      | join("\n\n---\n\n")
    ' 2>/dev/null || true)
    echo "CHANGES_REQUESTED"
    echo ""
    echo "--- Review Content (formal review) ---"
    printf '%s\n' "${review_content}"
    exit 1
  fi

  # コメント形式のレビュー（Claude bot 等が PR comment で投稿する場合）も検出する
  # 「🔄 Request Changes」または明示的な CHANGES_REQUESTED マーカーを含むコメントのみ対象
  # 誤検知防止のため author.login で Claude bot / github-actions bot に限定する
  # app/claude: GitHub App として動作する Claude bot の login 形式
  changes_comment_count=$(printf '%s' "${pr_data}" | jq '
    [.comments[]
     | select((.author.login // "") | test("^(github-actions\\[bot\\]|claude\\[bot\\]|claude-code\\[bot\\]|app/claude)$"; "i"))
     | select(.body | test("(?s)🔄.*Request Changes|CHANGES_REQUESTED"; "i"))] | length
  ' 2>/dev/null || echo "0")

  if [[ "${changes_comment_count}" -gt 0 ]]; then
    comment_content=$(printf '%s' "${pr_data}" | jq -r '
      [.comments[]
       | select((.author.login // "") | test("^(github-actions\\[bot\\]|claude\\[bot\\]|claude-code\\[bot\\]|app/claude)$"; "i"))
       | select(.body | test("(?s)🔄.*Request Changes|CHANGES_REQUESTED"; "i"))]
      | map("[@" + (.author.login // "unknown") + "]:\n" + .body)
      | join("\n\n---\n\n")
    ' 2>/dev/null || true)
    echo "CHANGES_REQUESTED"
    echo ""
    echo "--- Review Content (from comments) ---"
    printf '%s\n' "${comment_content}"
    exit 1
  fi

  # LGTM / Approve 系コメントも検出する
  # 誤検知防止のため author.login で Claude bot / github-actions bot に限定し、
  # 特定のフレーズのみ対象とする:
  #   "全件 PASS" / "全件PASS": レビュアーエージェントの PASS 宣言
  #   "✅.*\bPASS\b": CI/レビュー結果の ✅ + PASS（単語境界で "passed" 等の誤検知防止）
  #   "\bLGTM\b": 標準的な承認表現（単語境界で LGTMFAIL 等の誤検知防止）
  #   "Approve 相当": Claude bot の承認コメントフレーズ
  #   "マージ可能(?:です|と判断|。|！|$)": Claude bot の承認判定フレーズ（「マージ可能性がある」等の誤検知防止）
  #   "指摘[^0-9]?0(?![0-9])": 「指摘0件」のような確定0件表現（10件等との誤検知防止）
  approve_comment_count=$(printf '%s' "${pr_data}" | jq '
    [.comments[]
     | select((.author.login // "") | test("^(github-actions\\[bot\\]|claude\\[bot\\]|claude-code\\[bot\\]|app/claude)$"; "i"))
     | select(.body | test("(?s)全件 ?PASS(?!\\w)|\\bLGTM\\b|Approve 相当|マージ可能(?:です|と判断|。|！|$)|✅.*\\bPASS\\b|指摘[^0-9]?0(?![0-9])"; "i"))] | length
  ' 2>/dev/null || echo "0")

  if [[ "${approve_comment_count}" -gt 0 ]] && [[ "${changes_comment_count}" -eq 0 ]]; then
    echo "APPROVED"
    exit 0
  fi

  minutes_elapsed=$(( elapsed / 60 ))
  minutes_total=$(( TIMEOUT_SECONDS / 60 ))
  echo "PENDING: レビュー待ち (${minutes_elapsed}/${minutes_total} 分経過)" >&2

  remaining=$(( TIMEOUT_SECONDS - elapsed ))
  sleep_time=$(( POLL_INTERVAL_SECONDS < remaining ? POLL_INTERVAL_SECONDS : remaining ))
  sleep "${sleep_time}"
  elapsed=$(( elapsed + sleep_time ))
done

echo "TIMEOUT"
exit 2
