#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/launch-shard-emulators.sh"

@test "launch-shard-emulators.sh: adb を参照する仕様" {
  run bash -c 'grep -q "adb" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "launch-shard-emulators.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
