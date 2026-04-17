#!/usr/bin/env bash
#
# tests/scripts/evaluate-verdict.test.sh
# evaluate-verdict.sh の unit test

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="$SCRIPT_DIR/../../scripts/lib/evaluate-verdict.sh"

PASS=0
FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"; echo "    expected: '$expected'"; echo "    actual:   '$actual'"
    FAIL=$((FAIL + 1))
  fi
}

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

MOCK_BIN="$TMP_DIR/bin"
mkdir -p "$MOCK_BIN"
export PATH="$MOCK_BIN:$PATH"

CONFIG_FILE="$TMP_DIR/config.json"
cat > "$CONFIG_FILE" << 'JSON'
{"ci_workflow_name":"CI","claude_review_job_name":"claude-review","ai_review_pass_label":"AI Review: PASS","ai_review_needs_work_label":"AI Review: NEEDS WORK","polling_timeout_minutes":60}
JSON

# ---------------------------------------------------------------------------
# モックデータ書き込みヘルパー
# evaluate-verdict.sh は gh api / gh pr view の raw JSON を受けて
# 自分で jq を呼ぶ設計になっているため、モックは raw JSON をそのまま返す
# ---------------------------------------------------------------------------

setup_scenario() {
  local s="$1"
  local d="$TMP_DIR/data"
  mkdir -p "$d"

  # デフォルト（全部 empty）
  echo '{"workflow_runs":[]}' > "$d/runs.json"
  echo '{"jobs":[]}' > "$d/jobs.json"
  echo '{"labels":[]}' > "$d/labels.json"
  echo '{"comments":[]}' > "$d/comments.json"

  case "$s" in
    pending_no_run) ;;  # デフォルトのまま

    pending_run_in_progress)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"in_progress","conclusion":null,"event":"pull_request"}]}' > "$d/runs.json"
      ;;

    cancelled_run)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"cancelled","event":"pull_request"}]}' > "$d/runs.json"
      ;;

    pending_no_cr_job)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      # jobs は空のまま
      ;;

    cr_job_in_progress)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"in_progress","completed_at":""}]}' > "$d/jobs.json"
      ;;

    cr_job_skipped)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"skipped","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      ;;

    pending_no_label)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      # labels は空のまま
      ;;

    pending_no_comment)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: PASS"}]}' > "$d/labels.json"
      # comments は空のまま
      ;;

    non_claude_comment)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: PASS"}]}' > "$d/labels.json"
      printf '{"comments":[{"author":{"login":"human"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\\n全件 PASS（0件）"}]}' > "$d/comments.json"
      ;;

    approve)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: PASS"}]}' > "$d/labels.json"
      printf '{"comments":[{"author":{"login":"claude"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\\n**✅ Approve**\\n全件 PASS（0件）"}]}' > "$d/comments.json"
      ;;

    approve_no_bold)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: PASS"}]}' > "$d/labels.json"
      printf '{"comments":[{"author":{"login":"claude"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\\n✅ Approve"}]}' > "$d/comments.json"
      ;;

    approve_zero_pass)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: PASS"}]}' > "$d/labels.json"
      printf '{"comments":[{"author":{"login":"claude"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\\n全件 PASS（0件）"}]}' > "$d/comments.json"
      ;;

    request_changes)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"failure","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"failure","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: NEEDS WORK"}]}' > "$d/labels.json"
      printf '{"comments":[{"author":{"login":"claude"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\\n**🔄 Request Changes**\\nCRITICAL 1件"}]}' > "$d/comments.json"
      ;;

    comment_verdict)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: NEEDS WORK"}]}' > "$d/labels.json"
      printf '{"comments":[{"author":{"login":"claude"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\\n**💬 Comment**\\nLOW 2件"}]}' > "$d/comments.json"
      ;;

    multi_jobs_approve)
      echo '{"workflow_runs":[{"id":1,"name":"CI","status":"completed","conclusion":"success","event":"pull_request"}]}' > "$d/runs.json"
      echo '{"jobs":[{"name":"lint","conclusion":"success","completed_at":"2025-01-01T00:00:30Z"},{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"},{"name":"test","conclusion":"success","completed_at":"2025-01-01T00:01:30Z"}]}' > "$d/jobs.json"
      echo '{"labels":[{"name":"AI Review: PASS"}]}' > "$d/labels.json"
      printf '{"comments":[{"author":{"login":"claude"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\\n**✅ Approve**\\n全件 PASS（0件）"}]}' > "$d/comments.json"
      ;;
  esac

  # gh モック（raw JSON を返すだけ）
  cat > "$MOCK_BIN/gh" << GHEOF
#!/usr/bin/env bash
D="$d"
if [ "\${1:-}" = "repo" ] && [ "\${2:-}" = "view" ]; then
  jq_filter=""
  args=("\$@")
  for i in "\${!args[@]}"; do
    if [ "\${args[\$i]}" = "--jq" ]; then
      jq_filter="\${args[\$(( i + 1 ))]:-}"
    fi
  done
  case "\$jq_filter" in
    .owner.login) echo "owner"; exit 0 ;;
    .name)        echo "repo";  exit 0 ;;
  esac
  exit 0
fi
if [ "\${1:-}" = "api" ]; then
  url="\${2:-}"
  if echo "\$url" | grep -qE "actions/runs\?"; then
    cat "\$D/runs.json" 2>/dev/null || echo '{"workflow_runs":[]}'
    exit 0
  fi
  if echo "\$url" | grep -qE "actions/runs/[0-9]+/jobs"; then
    cat "\$D/jobs.json" 2>/dev/null || echo '{"jobs":[]}'
    exit 0
  fi
fi
if [ "\${1:-}" = "pr" ] && [ "\${2:-}" = "view" ]; then
  if echo "\$*" | grep -q "labels"; then
    cat "\$D/labels.json" 2>/dev/null || echo '{"labels":[]}'
    exit 0
  fi
  if echo "\$*" | grep -q "comments"; then
    cat "\$D/comments.json" 2>/dev/null || echo '{"comments":[]}'
    exit 0
  fi
fi
exit 0
GHEOF
  chmod +x "$MOCK_BIN/gh"
}

setup_gh_fail() {
  cat > "$MOCK_BIN/gh" << 'GHEOF'
#!/usr/bin/env bash
if [ "${1:-}" = "repo" ] && [ "${2:-}" = "view" ]; then
  case "${4:-}" in
    .owner.login) echo "owner"; exit 0 ;;
    .name)        echo "repo";  exit 0 ;;
  esac
fi
exit 1
GHEOF
  chmod +x "$MOCK_BIN/gh"
}

run_test() {
  local scenario="$1"
  local pr="${2:-123}"
  local sha="${3:-sha1}"
  local config="${4:-$CONFIG_FILE}"

  if [ "$scenario" = "gh_fail" ]; then
    setup_gh_fail
  else
    setup_scenario "$scenario"
  fi

  # shellcheck disable=SC1090
  source "$LIB"
  evaluate_verdict "$pr" "$sha" "$config" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
echo "=== evaluate-verdict.sh unit tests ==="
echo ""

echo "--- 条件1: CI run ---"
assert_eq "CI run なし → pending" "" "$(run_test pending_no_run)"
assert_eq "CI run in_progress → pending" "" "$(run_test pending_run_in_progress)"
assert_eq "CI run cancelled → pending" "" "$(run_test cancelled_run)"

echo ""
echo "--- 条件2: claude-review job ---"
assert_eq "claude-review job なし → pending" "" "$(run_test pending_no_cr_job)"
assert_eq "claude-review job in_progress → pending" "" "$(run_test cr_job_in_progress)"
assert_eq "claude-review job skipped → pending" "" "$(run_test cr_job_skipped)"

echo ""
echo "--- 条件3: ラベル ---"
assert_eq "AI Review ラベルなし → pending" "" "$(run_test pending_no_label)"

echo ""
echo "--- 条件3: コメント ---"
assert_eq "判定コメントなし → pending" "" "$(run_test pending_no_comment)"
assert_eq "claude 以外のコメント → pending" "" "$(run_test non_claude_comment)"

echo ""
echo "--- approve 判定 ---"
assert_eq "全条件クリア（**✅ Approve**）→ approve" "approve" "$(run_test approve)"
assert_eq "✅ Approve（bold なし）→ approve" "approve" "$(run_test approve_no_bold)"
assert_eq "全件 PASS（0件）パターン → approve" "approve" "$(run_test approve_zero_pass)"

echo ""
echo "--- request_changes 判定 ---"
assert_eq "🔄 Request Changes → request_changes" "request_changes" "$(run_test request_changes)"
assert_eq "💬 Comment → request_changes" "request_changes" "$(run_test comment_verdict)"

echo ""
echo "--- gh コマンド失敗 ---"
assert_eq "gh api 失敗 → pending" "" "$(run_test gh_fail)"

echo ""
echo "--- config なし（デフォルト値）---"
assert_eq "config なし → デフォルト値で approve" "approve" "$(run_test approve 123 sha1 /nonexistent)"

echo ""
echo "--- 引数バリデーション ---"
assert_eq "PR番号なし → 空文字" "" "$(run_test pending_no_run '' '')"

echo ""
echo "--- NEEDS WORK ラベル + request_changes ---"
assert_eq "NEEDS WORK ラベル + Request Changes → request_changes" "request_changes" "$(run_test request_changes)"

echo ""
echo "--- CI workflow name が異なる ---"
ALT_CONFIG="$TMP_DIR/alt-config.json"
cat > "$ALT_CONFIG" << 'JSON'
{"ci_workflow_name":"CustomCI","claude_review_job_name":"claude-review","ai_review_pass_label":"AI Review: PASS","ai_review_needs_work_label":"AI Review: NEEDS WORK"}
JSON
assert_eq "異なる CI workflow name → pending" "" "$(run_test pending_no_run 123 sha1 $ALT_CONFIG)"

echo ""
echo "--- edge case: workflow_runs 空 ---"
assert_eq "workflow_runs 空配列 → pending" "" "$(run_test pending_no_run 456 sha2)"

echo ""
echo "--- edge case: 複数 jobs のうち claude-review のみ確認 ---"
assert_eq "複数 jobs → approve" "approve" "$(run_test multi_jobs_approve 123 sha3)"

echo ""
echo "--- edge case: PR番号に文字を含む ---"
assert_eq "PR番号異常値 → 空文字" "" "$(run_test pending_no_run abc sha1)"

echo ""
echo "=== 結果 ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
