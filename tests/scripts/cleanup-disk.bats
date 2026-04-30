#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/cleanup-disk.sh"

@test "cleanup-disk.sh: --deep フラグを持つ" {
  grep -q -- "--deep" "$SCRIPT"
}

@test "cleanup-disk.sh: 構文エラーがない" {
  bash -n "$SCRIPT"
}

