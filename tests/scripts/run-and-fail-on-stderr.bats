#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/run-and-fail-on-stderr.sh"

@test "run-and-fail-on-stderr.sh: 引数なしでエラー終了する" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "run-and-fail-on-stderr.sh: stderr なしのコマンドは exit 0 を返す" {
  run bash "$SCRIPT" printf "hello"  
  [ "$status" -eq 0 ]
}

@test "run-and-fail-on-stderr.sh: stderr ありのコマンドは exit 1 を返す" {
  run bash "$SCRIPT" bash -c 'printf "err" >&2'
  [ "$status" -ne 0 ]
}

