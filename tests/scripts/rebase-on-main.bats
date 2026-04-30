#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/rebase-on-main.sh"

@test "rebase-on-main.sh: git を参照する仕様" {
  run bash -c 'grep -q "git" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "rebase-on-main.sh: 存在しないディレクトリでエラー終了する" {
  run bash "$SCRIPT" "/nonexistent/path/1234567"
  [ "$status" -ne 0 ]
}
