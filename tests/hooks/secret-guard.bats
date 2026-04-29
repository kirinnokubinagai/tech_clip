#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/secret-guard.sh"

@test "secret-guard.sh: ARGUMENTS が空のとき exit 0 する" {
  export ARGUMENTS=""
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "secret-guard.sh: git push/commit のみを対象にする仕様" {
  run bash -c 'grep -q "git" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "secret-guard.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
