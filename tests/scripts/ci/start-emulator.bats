#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/start-emulator.sh"

@test "start-emulator.sh: AVD_NAME 引数を取る仕様" {
  run bash -c 'grep -q "AVD_NAME" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "start-emulator.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
