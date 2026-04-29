#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/run-biome-check.sh"

@test "run-biome-check.sh: biome を呼び出す仕様" {
  grep -q "biome" "$SCRIPT"
}

@test "run-biome-check.sh: apps/packages/tests/scripts ディレクトリを対象にする仕様" {
  grep -qE "apps|packages|tests|scripts" "$SCRIPT"
}

