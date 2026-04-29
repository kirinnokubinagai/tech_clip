#!/usr/bin/env bats
# evaluate-verdict.sh の全 workflow チェック機能テスト
#
# Bug 1 修正検証: "CI" ワークフローだけでなく全 workflow run を確認すること
#
# 実行: bats tests/scripts/lib/evaluate-verdict.bats

LIB="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/lib/evaluate-verdict.sh"

setup() {
  TEST_DIR=$(mktemp -d)
  FAKE_BIN="$TEST_DIR/fake_bin"
  DATA_DIR="$TEST_DIR/data"
  mkdir -p "$FAKE_BIN" "$DATA_DIR"

  CONFIG_FILE="$TEST_DIR/config.json"
  cat > "$CONFIG_FILE" << 'EOF'
{
  "ci_workflow_name": "CI",
  "claude_review_job_name": "claude-review",
  "ai_review_pass_label": "AI Review: PASS",
  "ai_review_needs_work_label": "AI Review: NEEDS WORK",
  "polling_timeout_minutes": 60
}
EOF

  REAL_JQ=$(command -v jq || echo "jq")
  export PATH="$FAKE_BIN:$PATH"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# gh スタブ: DATA_DIR のファイルから raw JSON を返す
make_gh_stub() {
  local data_dir="$DATA_DIR"
  local real_jq="$REAL_JQ"

  cat > "$FAKE_BIN/gh" << STUB
#!/usr/bin/env bash
D="${data_dir}"
REAL_JQ="${real_jq}"

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
STUB
  chmod +x "$FAKE_BIN/gh"

  # デフォルトデータ
  echo '{"workflow_runs":[]}' > "$DATA_DIR/runs.json"
  echo '{"jobs":[]}' > "$DATA_DIR/jobs.json"
  echo '{"labels":[]}' > "$DATA_DIR/labels.json"
  echo '{"comments":[]}' > "$DATA_DIR/comments.json"
}

run_verdict() {
  # shellcheck source=/dev/null
  source "$LIB"
  evaluate_verdict "123" "abc1234" "$CONFIG_FILE" 2>/dev/null
}

# ─────────────────────────────────────────────
# Bug 1: 全 workflow run チェック
# ─────────────────────────────────────────────

# テスト1: CI のみ成功・E2E が in_progress の場合は pending を返すこと
@test "CI 成功・E2E in_progress の場合は pending を返すこと" {
  # Arrange
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "pull_request"},
    {"id": 2, "name": "PR E2E (Android)", "status": "in_progress", "conclusion": null, "event": "pull_request"}
  ]
}
EOF

  # Act
  result=$(run_verdict)

  # Assert
  [ "$result" = "pending" ]
}

# テスト2: CI 成功・E2E queued の場合は pending を返すこと
@test "CI 成功・E2E queued の場合は pending を返すこと" {
  # Arrange
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "pull_request"},
    {"id": 2, "name": "PR E2E (Android)", "status": "queued", "conclusion": null, "event": "pull_request"}
  ]
}
EOF

  # Act
  result=$(run_verdict)

  # Assert
  [ "$result" = "pending" ]
}

# テスト3: CI 成功・E2E failure の場合は request_changes を返すこと
@test "CI 成功・E2E failure の場合は request_changes を返すこと" {
  # Arrange
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "pull_request"},
    {"id": 2, "name": "PR E2E (Android)", "status": "completed", "conclusion": "failure", "event": "pull_request"}
  ]
}
EOF

  # Act
  result=$(run_verdict)

  # Assert
  [ "$result" = "request_changes" ]
}

# テスト4: CI 成功・E2E timed_out の場合は request_changes を返すこと
@test "CI 成功・E2E timed_out の場合は request_changes を返すこと" {
  # Arrange
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "pull_request"},
    {"id": 2, "name": "PR E2E (Android)", "status": "completed", "conclusion": "timed_out", "event": "pull_request"}
  ]
}
EOF

  # Act
  result=$(run_verdict)

  # Assert
  [ "$result" = "request_changes" ]
}

# テスト5: CI 成功・E2E cancelled の場合は pending を返すこと（再実行待ち）
@test "CI 成功・E2E cancelled の場合は pending を返すこと" {
  # Arrange
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "pull_request"},
    {"id": 2, "name": "PR E2E (Android)", "status": "completed", "conclusion": "cancelled", "event": "pull_request"}
  ]
}
EOF

  # Act
  result=$(run_verdict)

  # Assert
  [ "$result" = "pending" ]
}

# テスト6: CI・E2E 両方成功の場合は条件2/3 まで進むこと（pending はラベル不足による）
@test "CI・E2E 両方成功の場合は条件2以降の評価に進むこと（ラベルなし → pending）" {
  # Arrange
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "pull_request"},
    {"id": 2, "name": "PR E2E (Android)", "status": "completed", "conclusion": "success", "event": "pull_request"}
  ]
}
EOF
  cat > "$DATA_DIR/jobs.json" << 'EOF'
{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}
EOF
  # ラベルなしのまま

  # Act
  result=$(run_verdict)

  # Assert: 条件1はクリア、条件3-a のラベルがないので pending
  [ "$result" = "pending" ]
}

# テスト7: 全 run が成功かつ全条件クリアの場合は approve を返すこと
@test "CI・E2E 両方成功かつ全条件クリアの場合は approve を返すこと" {
  # Arrange
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "pull_request"},
    {"id": 2, "name": "PR E2E (Android)", "status": "completed", "conclusion": "success", "event": "pull_request"}
  ]
}
EOF
  cat > "$DATA_DIR/jobs.json" << 'EOF'
{"jobs":[{"name":"claude-review","conclusion":"success","completed_at":"2025-01-01T00:01:00Z"}]}
EOF
  cat > "$DATA_DIR/labels.json" << 'EOF'
{"labels":[{"name":"AI Review: PASS"}]}
EOF
  printf '{"comments":[{"author":{"login":"claude"},"createdAt":"2025-01-01T00:02:00Z","body":"## PRレビュー結果\n**✅ Approve**\n全件 PASS（0件）"}]}' > "$DATA_DIR/comments.json"

  # Act
  result=$(run_verdict)

  # Assert
  [ "$result" = "approve" ]
}

# テスト8: pull_request イベント以外の run は無視されること
@test "push イベントの workflow run は無視されること" {
  # Arrange: push イベントの run のみ存在（pull_request なし）
  make_gh_stub
  cat > "$DATA_DIR/runs.json" << 'EOF'
{
  "workflow_runs": [
    {"id": 1, "name": "CI", "status": "completed", "conclusion": "success", "event": "push"}
  ]
}
EOF

  # Act
  result=$(run_verdict)

  # Assert: PR に紐づく run がないので pending
  [ "$result" = "pending" ]
}

# テスト9: per_page=100 で取得していること（旧 per_page=20 ではなく）
@test "API 呼び出しが per_page=100 を使用していること" {
  run grep -E 'per_page=100' "$LIB"
  [ "$status" -eq 0 ]
}

# テスト10: 旧実装の「CI ワークフロー名フィルタのみ」が削除されていること
@test "最初の select が name フィルタのみに依存していないこと（全 run 取得）" {
  # ALL_RUNS 変数への代入で全 run を取得するロジックがあることを確認
  run grep -E 'ALL_RUNS' "$LIB"
  [ "$status" -eq 0 ]
}
