#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/migrate.sh"

@test "migrate.sh: ensure_nix_shell を呼び出す仕様" {
  run bash -c 'grep -q "ensure_nix_shell" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "migrate.sh: drizzle-kit migrate を呼ぶ仕様" {
  run bash -c 'grep -q "drizzle" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
