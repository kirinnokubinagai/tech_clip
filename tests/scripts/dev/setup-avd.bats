#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/setup-avd.sh"

@test "setup-avd.sh: ANDROID_HOME が未設定のとき構文チェック通過" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "setup-avd.sh: avdmanager を参照する仕様" {
  run bash -c 'grep -q "avdmanager" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
