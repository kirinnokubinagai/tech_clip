#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/start-api.sh"

@test "start-api.sh: API_CI_PORT を持つ仕様" {
  run bash -c 'grep -q "API_CI_PORT" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "start-api.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
