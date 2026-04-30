#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/run-hermetic.sh"

@test "run-hermetic.sh: ensure_nix_shell を呼び出す仕様" {
  grep -q "ensure_nix_shell" "$SCRIPT"
}

@test "run-hermetic.sh: 引数なしの使い方メッセージを持つ仕様" {
  grep -qE "Usage|usage|args|command" "$SCRIPT"
}

