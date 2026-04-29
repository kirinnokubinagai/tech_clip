#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/check-agent-timeouts.sh"

@test "check-agent-timeouts.sh: .claude/config.json を参照する仕様" {
  grep -q "config.json" "$SCRIPT"
}

@test "check-agent-timeouts.sh: polling_timeout_minutes を検証する仕様" {
  grep -q "polling_timeout_minutes" "$SCRIPT"
}

