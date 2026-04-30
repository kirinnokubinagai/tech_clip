#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/check-nix-hermetic.sh"

@test "check-nix-hermetic.sh: nix を参照する仕様" {
  grep -q "nix" "$SCRIPT"
}

@test "check-nix-hermetic.sh: チェック対象コマンド一覧を持つ仕様" {
  grep -qE "CMDS|turso|adb|maestro|pnpm" "$SCRIPT"
}

