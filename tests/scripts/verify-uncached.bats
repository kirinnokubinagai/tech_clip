#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/verify-uncached.sh"

@test "verify-uncached.sh: typecheck と test を対象タスクとして持つ仕様" {
  grep -qE "typecheck|test" "$SCRIPT"
}

@test "verify-uncached.sh: turbo を呼び出す仕様" {
  grep -q "turbo" "$SCRIPT"
}

