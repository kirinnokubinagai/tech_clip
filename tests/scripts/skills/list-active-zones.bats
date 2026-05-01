#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/skills/list-active-zones.sh"

@test "list-active-zones: --json で active_issues / active_zones キーを出す" {
  run bash "$SCRIPT" --json
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.active_issues'
  echo "$output" | jq -e '.active_zones'
}

@test "list-active-zones: 引数なしも成功する" {
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "list-active-zones: --exclude-issue で自分自身を除外する" {
  CURRENT_ISSUE=$(git worktree list --porcelain | grep -oE 'refs/heads/issue/[0-9]+' | head -1 | grep -oE '[0-9]+' || echo "")
  if [ -n "$CURRENT_ISSUE" ]; then
    run bash "$SCRIPT" --json --exclude-issue "$CURRENT_ISSUE"
    [ "$status" -eq 0 ]
    [ "$(echo "$output" | jq --arg n "$CURRENT_ISSUE" '.active_issues | index($n | tonumber)')" = "null" ]
  else
    skip "no active issue worktree"
  fi
}
