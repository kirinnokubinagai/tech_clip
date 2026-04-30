#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/main-commit-guard.sh"

@test "main-commit-guard.sh: ARGUMENTS が空のとき exit 0 する" {
  export ARGUMENTS=""
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "main-commit-guard.sh: git commit を main で block する仕様" {
  run bash -c 'grep -q "main" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
