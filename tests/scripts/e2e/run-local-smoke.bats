#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/e2e/run-local-smoke.sh"

@test "run-local-smoke.sh: ensure_nix_shell を呼び出す仕様" {
  run bash -c 'grep -q "ensure_nix_shell" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "run-local-smoke.sh: maestro を参照する仕様" {
  run bash -c 'grep -q "maestro" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
