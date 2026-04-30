#!/usr/bin/env bats
# conflict-check.sh のテスト

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/skills/conflict-check.sh"

@test "conflict-check.sh: analyst 名を {role}-{N} 形式で検索すること" {
  # analyst-${ISSUE_NUMBER} という形式が使われていること
  run bash -c 'grep -q "analyst-\${ISSUE_NUMBER}" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "conflict-check.sh: 実装系エージェント名のフィルタリングに新形式パターンを使うこと" {
  # startswith の引数が新形式（role-N）で始まること
  # 旧形式 issue-${ISSUE_NUMBER}- は使われていないこと
  run bash -c '! grep -q "issue-\${ISSUE_NUMBER}-analyst" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "conflict-check.sh: 実装系エージェントフィルタが coder|infra-engineer|ui-designer を含むこと" {
  run bash -c 'grep -q "coder\|infra-engineer\|ui-designer" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
