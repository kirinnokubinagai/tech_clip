#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/seed.sh"

@test "seed.sh: ensure_nix_shell を呼び出す仕様" {
  run bash -c 'grep -q "ensure_nix_shell" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "seed.sh: pnpm tsx seed-maestro-static を呼ぶ仕様" {
  run bash -c 'grep -q "seed-maestro-static" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
