#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/maestro-local.sh"

@test "maestro-local.sh: maestro を呼び出す仕様" {
  grep -q "maestro" "$SCRIPT"
}

@test "maestro-local.sh: ensure_nix_shell を呼び出す仕様" {
  grep -q "ensure_nix_shell" "$SCRIPT"
}

