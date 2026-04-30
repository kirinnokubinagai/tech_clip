#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/down.sh"

@test "down.sh: lsof を使う仕様" {
  run bash -c 'grep -q "lsof" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "down.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
