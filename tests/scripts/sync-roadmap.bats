#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/sync-roadmap.sh"

@test "sync-roadmap.sh: --fix フラグを持つ仕様" {
  grep -q -- "--fix" "$SCRIPT"
}

@test "sync-roadmap.sh: ROADMAP.md を参照する仕様" {
  grep -q "ROADMAP" "$SCRIPT"
}

