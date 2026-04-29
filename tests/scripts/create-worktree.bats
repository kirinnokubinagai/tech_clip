#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/create-worktree.sh"

@test "create-worktree.sh: 引数なしでエラー終了する" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "create-worktree.sh: issue-number が数値でないとエラー終了する" {
  run bash "$SCRIPT" "abc" "desc"
  [ "$status" -ne 0 ]
}

@test "create-worktree.sh: usage メッセージを持つ仕様" {
  run bash "$SCRIPT"
  [[ "$output" == *"usage"* ]] || [[ "$output" == *"Usage"* ]] || [[ "$output" == *"issue-number"* ]]
}
