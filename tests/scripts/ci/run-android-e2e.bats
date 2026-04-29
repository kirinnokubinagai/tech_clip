#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/run-android-e2e.sh"

@test "run-android-e2e.sh: SHARD_INDEX 変数を持つ仕様" {
  run bash -c 'grep -q "SHARD_INDEX" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "run-android-e2e.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
