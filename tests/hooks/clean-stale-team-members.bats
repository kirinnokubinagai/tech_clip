#!/usr/bin/env bats
# clean-stale-team-members.sh のテスト
#
# 方針（Fix D 改訂版）:
# - session 不一致 or leadSessionId 欠落 → config.json を rm して exit 0
# - session 一致 → suffix 付き agent を jq で除去 + PR ベース判定
# - config.json の個別フィールド編集は行わない（削除が公式ワークアラウンド）
#
# session_id フィールド名: Claude Code 公式ドキュメントで確認済み (snake_case)
# ref: https://docs.anthropic.com/en/docs/claude-code/hooks (common input fields)

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/clean-stale-team-members.sh"

setup() {
  TMPDIR=$(mktemp -d)
  FAKE_BIN="$TMPDIR/bin"
  mkdir -p "$FAKE_BIN"
  REPO_ROOT="$TMPDIR/repo"
  mkdir -p "$REPO_ROOT/.claude-user/teams/active-issues"

  # git mock
  cat > "$FAKE_BIN/git" << 'GITEOF'
#!/usr/bin/env bash
if [[ "$*" == *"rev-parse --show-toplevel"* ]]; then
  echo "$REPO_ROOT"
elif [[ "$*" == *"branch -a"* ]]; then
  echo ""
fi
exit 0
GITEOF
  chmod +x "$FAKE_BIN/git"

  # gh mock (default: auth ok, no PRs)
  cat > "$FAKE_BIN/gh" << 'GHEOF'
#!/usr/bin/env bash
case "$1" in
  auth) [ "$2" = "token" ] && echo "fake-token" && exit 0 ;;
  repo) echo "owner/repo"; exit 0 ;;
  pr)   echo ""; exit 0 ;;
esac
exit 0
GHEOF
  chmod +x "$FAKE_BIN/gh"

  export PATH="$FAKE_BIN:$PATH"
  export REPO_ROOT
}

teardown() { rm -rf "$TMPDIR"; }

TEAM_CONFIG_PATH() {
  echo "$REPO_ROOT/.claude-user/teams/active-issues/config.json"
}

write_config() {
  local json="$1"
  printf '%s' "$json" > "$(TEAM_CONFIG_PATH)"
}

config_exists() {
  [ -f "$(TEAM_CONFIG_PATH)" ]
}

read_config() {
  cat "$(TEAM_CONFIG_PATH)"
}

run_hook() {
  local stdin_data="${1:-}"
  printf '%s' "$stdin_data" | \
    REPO_ROOT="$REPO_ROOT" bash "$SCRIPT"
}

# ─────────────────────────────────────────────
# smoke: スクリプト構造チェック
# ─────────────────────────────────────────────

@test "clean-stale-team-members.sh: TEAM_CONFIG を参照する仕様" {
  run bash -c 'grep -q "TEAM_CONFIG" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "clean-stale-team-members.sh: config.json がないとき exit 0 する仕様" {
  run bash -c 'grep -q "exit 0" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "clean-stale-team-members.sh: PR MERGED 状態を検出する仕様" {
  run bash -c 'grep -q "MERGED" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

# ─────────────────────────────────────────────
# Fix D: session boundary — rm アプローチ
# ─────────────────────────────────────────────

@test "session 一致のとき config.json は削除されない" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  run_hook '{"session_id": "abc-123"}'

  # config.json が残っていること
  config_exists
}

@test "session 不一致のとき config.json が削除される" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"},
      {"name": "issue-200-reviewer", "agentType": "reviewer"}
    ]
  }'

  run_hook '{"session_id": "xyz-789"}'

  # config.json が削除されていること
  run config_exists
  [ "$status" -ne 0 ]
}

@test "session 不一致のとき exit 0 で終了する" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [{"name": "team-lead", "agentType": "team-lead"}]
  }'

  run run_hook '{"session_id": "xyz-789"}'
  [ "$status" -eq 0 ]
}

@test "leadSessionId がない旧 config は session 不一致扱いで config.json が削除される" {
  write_config '{
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  run_hook '{"session_id": "xyz-new"}'

  # config.json が削除されていること（leadSessionId なし = session 比較不可 → 削除）
  run config_exists
  [ "$status" -ne 0 ]
}

@test "session 一致 + suffix 付き agent は jq で除去される" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"},
      {"name": "issue-100-coder-2", "agentType": "coder"},
      {"name": "issue-200-ui-designer-3", "agentType": "ui-designer"}
    ]
  }'

  run_hook '{"session_id": "abc-123"}'

  # config.json が残っていること
  config_exists
  local after
  after=$(read_config)
  # suffix なし coder は残ること
  [[ "$after" == *'"issue-100-coder"'* ]]
  # suffix 付きは除去されること
  [[ "$after" != *"issue-100-coder-2"* ]]
  [[ "$after" != *"issue-200-ui-designer-3"* ]]
}

@test "session 一致 + suffix なし → config.json は変化しない" {
  local original='{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'
  write_config "$original"

  run_hook '{"session_id": "abc-123"}'

  config_exists
  local after
  after=$(read_config)
  [[ "$after" == *"issue-100-coder"* ]]
}

@test "session 不一致 + suffix 付き混在でも config.json は削除される" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"},
      {"name": "issue-100-coder-2", "agentType": "coder"}
    ]
  }'

  run_hook '{"session_id": "new-session-001"}'

  run config_exists
  [ "$status" -ne 0 ]
}

@test "stdin に session_id なし (空 JSON) → session 比較 skip、PR ベース判定のみ" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  # gh が MERGED を返す mock
  cat > "$FAKE_BIN/gh" << 'GHEOF'
#!/usr/bin/env bash
case "$1" in
  auth) [ "$2" = "token" ] && echo "fake-token" && exit 0 ;;
  repo) echo "owner/repo"; exit 0 ;;
  pr)   echo '{"state":"MERGED","mergedAt":"2024-01-01T00:00:00Z"}'; exit 0 ;;
esac
exit 0
GHEOF
  chmod +x "$FAKE_BIN/gh"

  run_hook '{}'

  # config.json が残っていること（削除はしない）
  config_exists
  local after
  after=$(read_config)
  # PR MERGED で issue-100-coder が除去される
  [[ "$after" != *"issue-100-coder"* ]]
}

@test "stdin が空のとき session 比較をスキップして exit 0" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  run run_hook ""
  [ "$status" -eq 0 ]
  config_exists
}

@test "stdin が不正 JSON のとき session 比較をスキップして exit 0" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [{"name": "team-lead", "agentType": "team-lead"}]
  }'

  run run_hook "not-json"
  [ "$status" -eq 0 ]
}

@test "config.json が存在しないとき exit 0" {
  rm -rf "$REPO_ROOT/.claude-user/teams/active-issues"

  run run_hook '{"session_id": "xyz"}'
  [ "$status" -eq 0 ]
}

@test "gh がエラーでも session 不一致なら config.json が削除される" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  # gh auth 失敗
  cat > "$FAKE_BIN/gh" << 'GHEOF'
#!/usr/bin/env bash
exit 1
GHEOF
  chmod +x "$FAKE_BIN/gh"

  # gh auth 失敗で PR 判定 skip → session 不一致なら削除だけ行う
  run_hook '{"session_id": "new-abc"}'

  run config_exists
  [ "$status" -ne 0 ]
}
