#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/show-e2e-failures.sh"

@test "show-e2e-failures.sh: --format オプションを持つ仕様" {
  run bash -c 'grep -q "format" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "show-e2e-failures.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
