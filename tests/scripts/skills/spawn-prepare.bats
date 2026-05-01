#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/skills/spawn-prepare.sh"

@test "spawn-prepare: zone 衝突最終ガードのコードが存在する" {
  grep -q "list-active-zones.sh" "$SCRIPT"
  grep -q "detect-issue-zones.sh" "$SCRIPT"
  grep -q "zone conflict detected" "$SCRIPT"
}

@test "spawn-prepare: --exclude-issue で自分を除外する" {
  grep -q -- "--exclude-issue" "$SCRIPT"
}
