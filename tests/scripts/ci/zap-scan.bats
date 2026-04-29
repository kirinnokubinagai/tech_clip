#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/zap-scan.sh"

@test "zap-scan.sh: ZAP_PORT 環境変数を参照する仕様" {
  run bash -c 'grep -q "ZAP_PORT" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "zap-scan.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}
