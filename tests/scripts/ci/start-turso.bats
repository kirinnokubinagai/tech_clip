#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/start-turso.sh"

@test "start-turso.sh: TURSO_CI_PORT を持つ仕様" {
  run bash -c 'grep -q "TURSO_CI_PORT" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "start-turso.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
