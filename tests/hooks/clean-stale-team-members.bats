#!/usr/bin/env bats
# clean-stale-team-members.sh のテスト
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

write_config() {
  local json="$1"
  printf '%s' "$json" > "$REPO_ROOT/.claude-user/teams/active-issues/config.json"
}

read_config() {
  cat "$REPO_ROOT/.claude-user/teams/active-issues/config.json"
}

run_hook() {
  local stdin_data="${1:-}"
  printf '%s' "$stdin_data" |     REPO_ROOT="$REPO_ROOT" bash "$SCRIPT"
}

# ─────────────────────────────────────────────
# 既存テスト (smoke)
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
# Fix D: session boundary tests (RED → GREEN)
# ─────────────────────────────────────────────

# テスト 1: session 一致 → wipe しない
@test "session 一致のとき members は変化しない" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  run_hook '{"session_id": "abc-123"}'

  local after
  after=$(read_config)
  # issue-100-coder が残っていること
  [[ "$after" == *"issue-100-coder"* ]]
  # leadSessionId が変化していないこと
  [[ "$after" == *'"abc-123"'* ]]
}

# テスト 2: session 不一致 → team-lead 以外をすべて wipe、leadSessionId を更新
@test "session 不一致のとき team-lead 以外を全除去し leadSessionId を更新する" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"},
      {"name": "issue-200-reviewer", "agentType": "reviewer"}
    ]
  }'

  run_hook '{"session_id": "xyz-789"}'

  local after
  after=$(read_config)
  # team-lead が残ること
  [[ "$after" == *'"team-lead"'* ]]
  # issue-100-coder が除去されること
  [[ "$after" != *"issue-100-coder"* ]]
  # issue-200-reviewer が除去されること
  [[ "$after" != *"issue-200-reviewer"* ]]
  # leadSessionId が新 session ID に更新されること
  [[ "$after" == *'"xyz-789"'* ]]
}

# テスト 3: suffix 付き agent は session 一致でも無条件除去
@test "suffix 付き agent は session 一致でも除去される" {
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

  local after
  after=$(read_config)
  # suffix なし coder は残ること
  [[ "$after" == *'"issue-100-coder"'* ]]
  # suffix 付き coder-2 は除去されること
  [[ "$after" != *"issue-100-coder-2"* ]]
  # suffix 付き ui-designer-3 は除去されること
  [[ "$after" != *"issue-200-ui-designer-3"* ]]
  # leadSessionId は不変
  [[ "$after" == *'"abc-123"'* ]]
}

# テスト 4: session 不一致 + suffix 付き混在 → team-lead 以外全除去
@test "session 不一致 + suffix 付きの混在: team-lead のみ残る" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"},
      {"name": "issue-100-coder-2", "agentType": "coder"}
    ]
  }'

  run_hook '{"session_id": "new-session-001"}'

  local after
  after=$(read_config)
  [[ "$after" == *'"team-lead"'* ]]
  [[ "$after" != *"issue-100-coder"* ]]
  [[ "$after" == *'"new-session-001"'* ]]
}

# テスト 5: stdin に session_id なし → PR ベース判定のみ
@test "stdin に session_id がない場合 PR ベース判定で除去される" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  # gh が MERGED を返す mock に差し替え
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

  local after
  after=$(read_config)
  # leadSessionId は変化しない
  [[ "$after" == *'"abc-123"'* ]]
  # PR MERGED で issue-100-coder が除去される
  [[ "$after" != *"issue-100-coder"* ]]
}

# テスト 6a: stdin が空 → session 比較 skip、exit 0
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
  # leadSessionId は不変
  local after
  after=$(read_config)
  [[ "$after" == *'"abc-123"'* ]]
}

# テスト 6b: stdin が不正 JSON → session 比較 skip、exit 0
@test "stdin が不正 JSON のとき session 比較をスキップして exit 0" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [{"name": "team-lead", "agentType": "team-lead"}]
  }'

  run run_hook "not-json"
  [ "$status" -eq 0 ]
}

# テスト 7: leadSessionId が config に存在しない (旧 config)
@test "leadSessionId がない旧 config でも session 比較 skip し exit 0" {
  write_config '{
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  run_hook '{"session_id": "xyz-new"}'

  local after
  after=$(read_config)
  # 比較 skip → メンバーは変化しない (PR 判定のみ)
  # leadSessionId が補完されていること
  [[ "$after" == *'"xyz-new"'* ]]
}

# テスト 8: config.json 不在 → exit 0
@test "config.json が存在しないとき exit 0" {
  rm -rf "$REPO_ROOT/.claude-user/teams/active-issues"

  run run_hook '{"session_id": "xyz"}'
  [ "$status" -eq 0 ]
}

# テスト 9: gh network エラーでも session 比較は独立して動作
@test "gh がエラーでも session 不一致なら wipe される" {
  write_config '{
    "leadSessionId": "abc-123",
    "members": [
      {"name": "team-lead", "agentType": "team-lead"},
      {"name": "issue-100-coder", "agentType": "coder"}
    ]
  }'

  # gh が全コマンドで exit 1 返す
  cat > "$FAKE_BIN/gh" << 'GHEOF'
#!/usr/bin/env bash
exit 1
GHEOF
  chmod +x "$FAKE_BIN/gh"

  # gh auth 失敗 → 既存の exit 0 フォールバック
  run run_hook '{"session_id": "new-abc"}'
  [ "$status" -eq 0 ]
}
