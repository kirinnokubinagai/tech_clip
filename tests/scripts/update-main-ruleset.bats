#!/usr/bin/env bats
ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
SCRIPT="$ROOT/scripts/update-main-ruleset.sh"
CONFIG="$ROOT/.claude/config.json"

@test "update-main-ruleset.sh: gh を使う仕様" {
  grep -q "gh" "$SCRIPT"
}

@test "update-main-ruleset.sh: RULESET_ID 変数を持つ" {
  grep -q "RULESET_ID" "$SCRIPT"
}

@test "config: required status check が pull_request の表示名と完全一致する" {
  run jq -r '.required_status_check_context' "$CONFIG"

  [ "$status" -eq 0 ]
  [ "$output" = "CI / ci-gate (pull_request)" ]
}

