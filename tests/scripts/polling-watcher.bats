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

# テスト 1: BLOCKED + IN_PROGRESS check あり → timeout まで回り続けて timeout で抜けること (Fix F)
# started_at を古い時刻に設定して timeout を即発動させる
@test "BLOCKED + IN_PROGRESS check ありの場合は timeout になるまでループし timeout で抜けること" {
  # Arrange: started_at を1時間前に設定してタイムアウト即発動
  local old_start
  old_start=$(date -u -v-3601S "+%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
    || date -u -d "1 hour ago" "+%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
    || date -u "+%Y-%m-%dT%H:%M:%SZ")
  cat > "$TEST_DIR/.claude/polling/pr-42.json" <<EOF2
{
  "pr_number": 42,
  "push_sha": "abc1234",
  "issue_number": 999,
  "agent_name": "issue-999-reviewer",
  "started_at": "${old_start}"
}
EOF2

  local rollup='[{"name":"ci","status":"IN_PROGRESS","conclusion":null}]'
  make_gh_stub "OPEN" "BLOCKED" "$rollup"

  # Act: POLLING_INTERNAL_DEADLINE_SEC=0 は無視され、timeout で抜けること
  cd "$TEST_DIR"
  POLLING_INTERNAL_DEADLINE_SEC=0 run bash "$SCRIPT" 42 "$TEST_DIR"

  # Assert: timeout で抜けること（still_pending は返さない）
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "VERDICT: timeout"
  ! echo "$output" | grep -q "VERDICT: still_pending"
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

# ─────────────────────────────────────────────
# Fix F: 連続ポーリング — still_pending 廃止テスト
# ─────────────────────────────────────────────

# テスト 6: BLOCKED + IN_PROGRESS check ありでも TIMEOUT まで回り続けること
# (POLLING_INTERNAL_DEADLINE_SEC を設定しても still_pending を返さない)
@test "Fix F: BLOCKED+IN_PROGRESS で POLLING_INTERNAL_DEADLINE_SEC を設定しても still_pending を返さないこと" {
  # Arrange: timeout を即発動させる（started_at を1時間前に設定）
  local old_start
  old_start=$(date -u -v-3601S "+%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
    || date -u -d "1 hour ago" "+%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
    || date -u "+%Y-%m-%dT%H:%M:%SZ")
  cat > "$TEST_DIR/.claude/polling/pr-42.json" <<EOF2
{
  "pr_number": 42,
  "push_sha": "abc1234",
  "issue_number": 999,
  "agent_name": "issue-999-reviewer",
  "started_at": "${old_start}"
}
EOF2

  local rollup='[{"name":"ci","status":"IN_PROGRESS","conclusion":null}]'
  make_gh_stub "OPEN" "BLOCKED" "$rollup"

  cd "$TEST_DIR"
  # POLLING_INTERNAL_DEADLINE_SEC=0 を渡しても still_pending ではなく timeout を返す
  POLLING_INTERNAL_DEADLINE_SEC=0 run bash "$SCRIPT" 42 "$TEST_DIR"

  [ "$status" -eq 0 ]
  # timeout を返すこと（still_pending ではない）
  echo "$output" | grep -q "VERDICT: timeout"
  ! echo "$output" | grep -q "VERDICT: still_pending"
}

# テスト 7: ポーリング間隔のデフォルトが 30 秒であること（config に interval 指定なし）
@test "Fix F: デフォルトのポーリング間隔は 30 秒であること" {
  run bash -c 'grep -E "INTERVAL_SEC.*30|30.*INTERVAL" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

# テスト 8: still_pending の分岐が削除されていること
@test "Fix F: スクリプトに still_pending の VERDICT 出力が存在しないこと" {
  run bash -c 'grep -q "VERDICT: still_pending" "'"$SCRIPT"'"'
  # grep が 0 を返す = still_pending が存在する → テスト失敗
  [ "$status" -ne 0 ]
}

# ─────────────────────────────────────────────
# Bug 2: approve 前の mergeStateStatus 最終確認
# ─────────────────────────────────────────────

# テスト 9: mergeStateStatus チェックのコードがスクリプトに存在すること
@test "approve 前に FINAL_MERGE_STATE を確認するコードが存在すること" {
  run bash -c 'grep -q "FINAL_MERGE_STATE" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

# テスト 10: CLEAN 以外では VERDICT: approve を出力しないこと
@test "mergeStateStatus=BLOCKED の場合 VERDICT: approve を出力しないコードになっていること" {
  # approve 前に FINAL_MERGE_STATE を確認し CLEAN/UNSTABLE/HAS_HOOKS 以外は fall-through する構造を確認
  run bash -c 'grep -A5 "FINAL_MERGE_STATE" "'"$SCRIPT"'" | grep -q "treating as pending"'
  [ "$status" -eq 0 ]
}

# テスト 11: CLEAN の場合のみ approve を発行するコード構造になっていること
@test "CLEAN/UNSTABLE/HAS_HOOKS の場合のみ approve を発行するコード構造であること" {
  run bash -c 'grep -qE "FINAL_MERGE_STATE.*!=.*CLEAN" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

# テスト 12: approve 分岐内で gh pr view mergeStateStatus を呼んでいること
@test "approve 分岐で gh pr view mergeStateStatus を呼んでいること" {
  run bash -c 'grep -q "gh pr view.*mergeStateStatus" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

# テスト 13: approve 後にも sleep が継続するコードが存在すること（mergeStateStatus 不一致時）
@test "mergeStateStatus 不一致時に sleep して継続するコードが存在すること" {
  # FINAL_MERGE_STATE が不一致の場合は fall through して sleep に達する構造
  run bash -c 'grep -c "FINAL_MERGE_STATE" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
  [ "$output" -ge 1 ]
}
