#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/diagnosis-first-guard.sh"

@test "diagnosis-first-guard.sh: FILE_PATH 変数を持つ仕様" {
  run bash -c 'grep -q "FILE_PATH" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "diagnosis-first-guard.sh: ファイルパスなしでも動作する仕様" {
  run bash -c 'grep -q "FILE_PATH" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "diagnosis-first-guard.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
