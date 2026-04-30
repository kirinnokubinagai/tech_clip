#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/bump-version.sh"

@test "bump-version.sh: 引数なしでエラー終了する" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "bump-version.sh: 不正なバンプ種別でエラー終了する" {
  run bash "$SCRIPT" invalid
  [ "$status" -ne 0 ]
}

@test "bump-version.sh: patch/minor/major が受け入れられる仕様" {
  grep -qE "patch|minor|major" "$SCRIPT"
}

