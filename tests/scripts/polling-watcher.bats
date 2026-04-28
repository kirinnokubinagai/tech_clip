#!/usr/bin/env bats
# polling-watcher.sh の BLOCKED 分岐テスト
#
# 実行: bats tests/scripts/polling-watcher.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/polling-watcher.sh"

setup() {
  TEST_DIR=$(mktemp -d)
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN" "$TEST_DIR/.claude/polling"

  cat > "$TEST_DIR/.claude/config.json" <<'EOF'
{
  "polling_timeout_minutes": 60,
  "polling_interval_minutes": 0,
  "ci_workflow_name": "CI",
  "claude_review_job_name": "claude-review",
  "ai_review_pass_label": "AI Review: PASS",
  "ai_review_needs_work_label": "AI Review: NEEDS WORK"
}
EOF

  local now
  now=$(date -u "+%Y-%m-%dT%H:%M:%SZ")
  cat > "$TEST_DIR/.claude/polling/pr-42.json" <<EOF
{
  "pr_number": 42,
  "push_sha": "abc1234",
  "issue_number": 999,
  "agent_name": "issue-999-reviewer",
  "started_at": "${now}"
}
EOF

  REAL_JQ=$(command -v jq || echo "jq")
  export PATH="$FAKE_BIN:$PATH"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# gh スタブ生成: --jq フィルターを実際に jq で処理する
make_gh_stub() {
  local state="$1"
  local merge_state="$2"
  local check_rollup="$3"
  local real_jq="$REAL_JQ"

  cat > "$FAKE_BIN/gh" <<STUB
#!/usr/bin/env bash
ARGS="\$*"
REAL_JQ_BIN="${real_jq}"

JQ_FILTER=""
NEXT_IS_JQ=0
for arg in "\$@"; do
  if [ "\$NEXT_IS_JQ" = "1" ]; then
    JQ_FILTER="\$arg"
    NEXT_IS_JQ=0
  fi
  [ "\$arg" = "--jq" ] && NEXT_IS_JQ=1
done

apply_jq() {
  if [ -n "\$JQ_FILTER" ] && [ -x "\$REAL_JQ_BIN" ]; then
    printf '%s' "\$1" | "\$REAL_JQ_BIN" -r "\$JQ_FILTER" 2>/dev/null
  else
    printf '%s' "\$1"
  fi
}

# gh repo view: OWNER/REPO を空にして evaluate_verdict を pending にする
if echo "\$ARGS" | grep -q "repo view"; then
  apply_jq '{"owner":{"login":""},"name":""}'
  exit 0
fi
if echo "\$ARGS" | grep -q "statusCheckRollup"; then
  apply_jq '{"statusCheckRollup":${check_rollup}}'
  exit 0
fi
if echo "\$ARGS" | grep -q "mergeStateStatus"; then
  apply_jq '{"mergeStateStatus":"${merge_state}"}'
  exit 0
fi
if echo "\$ARGS" | grep -q -- "--json state" && ! echo "\$ARGS" | grep -q "reviews\|comments\|labels"; then
  apply_jq '{"state":"${state}"}'
  exit 0
fi
# その他 (evaluate_verdict 用): デフォルトは pending 相当
apply_jq '{"reviewDecision":null,"reviews":[],"comments":[],"labels":[]}'
STUB

  chmod +x "$FAKE_BIN/gh"
}

# テスト 1: BLOCKED + IN_PROGRESS check あり → fall through して still_pending で抜けること
# POLLING_INTERNAL_DEADLINE_SEC=0 で内部 deadline を即発動させる
@test "BLOCKED + IN_PROGRESS check ありの場合は fall through して still_pending で抜けること" {
  # Arrange
  local rollup='[{"name":"ci","status":"IN_PROGRESS","conclusion":null}]'
  make_gh_stub "OPEN" "BLOCKED" "$rollup"

  # Act: POLLING_INTERNAL_DEADLINE_SEC=0 → evaluate_verdict(pending)後即 still_pending
  cd "$TEST_DIR"
  POLLING_INTERNAL_DEADLINE_SEC=0 run bash "$SCRIPT" 42 "$TEST_DIR"

  # Assert: request_changes ではなく still_pending で抜けること
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "VERDICT: still_pending"
  # BLOCKED 直接の request_changes は出ない
  ! echo "$output" | grep -q "BLOCKED: PR #"
}

# テスト 2: BLOCKED + 全 check COMPLETED → request_changes を返すこと
@test "BLOCKED + 全 check COMPLETED の場合は request_changes を返すこと" {
  local rollup='[{"name":"ci","status":"COMPLETED","conclusion":"FAILURE"}]'
  make_gh_stub "OPEN" "BLOCKED" "$rollup"

  cd "$TEST_DIR"
  run bash "$SCRIPT" 42 "$TEST_DIR"

  [ "$status" -eq 0 ]
  echo "$output" | grep -q "VERDICT: request_changes"
}

# テスト 3: BLOCKED + statusCheckRollup 空配列 → request_changes を返すこと
@test "BLOCKED + statusCheckRollup が空の場合は request_changes を返すこと" {
  local rollup='[]'
  make_gh_stub "OPEN" "BLOCKED" "$rollup"

  cd "$TEST_DIR"
  run bash "$SCRIPT" 42 "$TEST_DIR"

  [ "$status" -eq 0 ]
  echo "$output" | grep -q "VERDICT: request_changes"
}

# テスト 4: PR が MERGED → external_merged を返すこと
@test "PR が MERGED の場合は external_merged を返すこと" {
  make_gh_stub "MERGED" "CLEAN" "[]"

  cd "$TEST_DIR"
  run bash "$SCRIPT" 42 "$TEST_DIR"

  [ "$status" -eq 0 ]
  echo "$output" | grep -q "VERDICT: external_merged"
}

# テスト 5: mergeStateStatus が DIRTY → conflict を返すこと
@test "mergeStateStatus が DIRTY の場合は conflict を返すこと" {
  make_gh_stub "OPEN" "DIRTY" "[]"

  cd "$TEST_DIR"
  run bash "$SCRIPT" 42 "$TEST_DIR"

  [ "$status" -eq 0 ]
  echo "$output" | grep -q "VERDICT: conflict"
}
