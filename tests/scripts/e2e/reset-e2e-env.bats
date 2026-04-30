#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/e2e/reset-e2e-env.sh"

@test "reset-e2e-env.sh: ensure_nix_shell を呼び出す仕様" {
  run bash -c 'grep -q "ensure_nix_shell" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "reset-e2e-env.sh: TURSO_DATABASE_URL を参照する仕様" {
  run bash -c 'grep -q "TURSO_DATABASE_URL" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
