#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/up.sh"

@test "up.sh: ensure_nix_shell を呼び出す仕様" {
  run bash -c 'grep -q "ensure_nix_shell" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "up.sh: LOG_DIR を定義する仕様" {
  run bash -c 'grep -q "LOG_DIR" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
