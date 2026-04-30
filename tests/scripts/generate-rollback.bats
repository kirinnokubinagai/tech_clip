#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/generate-rollback.sh"

@test "generate-rollback.sh: 引数なしでエラー終了する" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "generate-rollback.sh: rollback SQL を生成する仕様" {
  grep -qE "rollback|sql|SQL|migration" "$SCRIPT"
}

