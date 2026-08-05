#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/start-api.sh"

@test "start-api.sh: API_CI_PORT を持つ仕様" {
  run bash -c 'grep -q "API_CI_PORT" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "start-api.sh: Wrangler は専用 CI dev shell で起動する" {
  run bash -c 'grep -q "nohup nix develop .#ci --command bash -c" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "start-api.sh: workspace 固定版 Wrangler を pnpm exec で起動する" {
  run bash -c 'grep -q "pnpm exec wrangler dev --config wrangler.ci.toml" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "start-api.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
