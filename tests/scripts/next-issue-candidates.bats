#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/next-issue-candidates.sh"

@test "next-issue-candidates.sh: --json フラグを持つ仕様" {
  grep -q -- "--json" "$SCRIPT"
}

@test "next-issue-candidates.sh: gh を呼ぶ仕様" {
  grep -q "gh " "$SCRIPT"
}

