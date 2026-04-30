#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/clean-stale-team-members.sh"

@test "clean-stale-team-members.sh: TEAM_CONFIG を参照する仕様" {
  run bash -c 'grep -q "TEAM_CONFIG" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "clean-stale-team-members.sh: config.json がないとき exit 0 する仕様" {
  run bash -c 'grep -q "exit 0" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "clean-stale-team-members.sh: PR MERGED 状態を検出する仕様" {
  run bash -c 'grep -q "MERGED" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
