#!/usr/bin/env bats
ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
SCRIPT="$ROOT/scripts/update-main-ruleset.sh"
CONFIG="$ROOT/.claude/config.json"
DOC="$ROOT/docs/CI_ARCHITECTURE.md"
EXPECTED_CONTEXT="ci-gate"

@test "update-main-ruleset.sh: gh を使う仕様" {
  grep -q "gh" "$SCRIPT"
}

@test "update-main-ruleset.sh: RULESET_ID 変数を持つ" {
  grep -q "RULESET_ID" "$SCRIPT"
}

@test "config: required status check context が job 名と完全一致すること" {
  run jq -r '.required_status_check_context' "$CONFIG"

  [ "$status" -eq 0 ]
  [ "$output" = "$EXPECTED_CONTEXT" ]
}

@test "update-main-ruleset.sh: config 不在時の既定 context が job 名と完全一致すること" {
  run grep -F 'REQUIRED_CHECK="${REQUIRED_CHECK:-${CONFIG_CHECK:-ci-gate}}"' "$SCRIPT"

  [ "$status" -eq 0 ]
}

@test "CI_ARCHITECTURE.md: required context を job 名として記載すること" {
  run grep -F 'required status check context は `<job name>` 形式で、この ruleset では `ci-gate`。' "$DOC"

  [ "$status" -eq 0 ]
}

@test "required context の source of truth に workflow 名または event suffix を含めないこと" {
  run grep -E 'CI / ci-gate|ci-gate \(pull_request\)' "$CONFIG" "$SCRIPT" "$DOC"

  [ "$status" -eq 1 ]
}

