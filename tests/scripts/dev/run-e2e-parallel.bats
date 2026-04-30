#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/run-e2e-parallel.sh"

@test "run-e2e-parallel.sh: maestro を参照する仕様" {
  run bash -c 'grep -q "maestro" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "run-e2e-parallel.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
