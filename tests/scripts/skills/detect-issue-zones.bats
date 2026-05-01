#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/skills/detect-issue-zones.sh"

@test "detect-issue-zones: text に oauth キーワードが含まれれば api-auth を検出する" {
  run bash "$SCRIPT" --text "OAuth callback fix" --json
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.zones | index("api-auth")'
}

@test "detect-issue-zones: text に migration キーワードが含まれれば api-migration を検出する" {
  run bash "$SCRIPT" --text "drizzle schema migration update" --json
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.zones | index("api-migration")'
}

@test "detect-issue-zones: 複数 zone HIT を全て返す" {
  run bash "$SCRIPT" --text "oauth session migration" --json
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.zones | index("api-auth")'
  echo "$output" | jq -e '.zones | index("api-migration")'
}

@test "detect-issue-zones: HIT なしなら空配列" {
  run bash "$SCRIPT" --text "完全に無関係なテキスト xyzxyz" --json
  [ "$status" -eq 0 ]
  [ "$(echo "$output" | jq '.zones | length')" -eq 0 ]
}

@test "detect-issue-zones: file path 一致でも HIT する" {
  run bash "$SCRIPT" --text "modify apps/api/drizzle/0008.sql" --json
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.zones | index("api-migration")'
}

@test "detect-issue-zones: --issue または --text 必須" {
  run bash "$SCRIPT" --json
  [ "$status" -ne 0 ]
}
