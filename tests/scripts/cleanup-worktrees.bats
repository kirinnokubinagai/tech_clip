#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/cleanup-worktrees.sh"

@test "cleanup-worktrees.sh: --dry-run フラグを持つ仕様" {
  run bash -c 'grep -q "dry.run" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "cleanup-worktrees.sh: --yes フラグを持つ仕様" {
  run bash -c 'grep -q "\-\-yes" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "cleanup-worktrees.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
