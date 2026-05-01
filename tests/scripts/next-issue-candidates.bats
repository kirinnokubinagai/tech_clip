#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/next-issue-candidates.sh"

@test "next-issue-candidates.sh: --json フラグを持つ仕様" {
  grep -q -- "--json" "$SCRIPT"
}

@test "next-issue-candidates.sh: gh を呼ぶ仕様" {
  grep -q "gh " "$SCRIPT"
}

@test "next-issue-candidates.sh: --json 出力に active_zones / active_issues キーを含む" {
  run bash "$SCRIPT" --json
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.active_zones'
  echo "$output" | jq -e '.active_issues'
}

@test "next-issue-candidates.sh: auto_assignable 各 issue に zones / blocked_by_active が付与される" {
  run bash "$SCRIPT" --json
  [ "$status" -eq 0 ]
  COUNT=$(echo "$output" | jq '.auto_assignable | length')
  if [ "$COUNT" -gt 0 ]; then
    echo "$output" | jq -e '.auto_assignable[0].zones'
    echo "$output" | jq -e '.auto_assignable[0] | has("blocked_by_active")'
  else
    skip "no auto_assignable issues"
  fi
}
