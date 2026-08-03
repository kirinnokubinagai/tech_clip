#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/verify-uncached.sh"

@test "verify-uncached.sh: typecheck と test を対象タスクとして持つ仕様" {
  grep -qE "typecheck|test" "$SCRIPT"
}

@test "verify-uncached.sh: turbo を呼び出す仕様" {
  grep -q "turbo" "$SCRIPT"
}

@test "verify-uncached.sh: 正常な stderr を失敗扱いするラッパーを使わない" {
  run grep -q "run-and-fail-on-stderr" "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "verify-uncached.sh: 正規の force 指定で完全再実行する" {
  run grep -q -- "--force" "$SCRIPT"
  [ "$status" -eq 0 ]

  run grep -q -- "--no-cache" "$SCRIPT"
  [ "$status" -ne 0 ]

  run grep -q -- "--cache=local:r,remote:r" "$SCRIPT"
  [ "$status" -ne 0 ]
}

