#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/update-main-ruleset.sh"

@test "update-main-ruleset.sh: gh を使う仕様" {
  grep -q "gh" "$SCRIPT"
}

@test "update-main-ruleset.sh: RULESET_ID 変数を持つ" {
  grep -q "RULESET_ID" "$SCRIPT"
}

