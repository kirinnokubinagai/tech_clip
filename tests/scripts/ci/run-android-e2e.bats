#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/run-android-e2e.sh"

@test "run-android-e2e.sh: SHARD_INDEX 変数を持つ仕様" {
  run bash -c 'grep -q "SHARD_INDEX" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "run-android-e2e.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "expo run:android を wait せず background で起動する（Metro は終了しない）" {
  # wait "$EXPO_PID" (with no || pattern) would hang forever; must NOT exist
  ! grep -E '^wait "\$EXPO_PID"' "$SCRIPT"
}

@test "pidof com.techclip.app でアプリ起動をポーリングする" {
  grep -E 'pidof com\.techclip\.app' "$SCRIPT"
}

@test "EXPO_LOG ファイルに tee してログを収集する" {
  grep -E 'EXPO_LOG' "$SCRIPT"
  grep -E 'tee.*EXPO_LOG|tee.*expo' "$SCRIPT"
}

@test "Metro の Bundled ログ出力を grep で検知する" {
  grep -E 'grep.*Bundled.*EXPO_LOG|grep.*Bundled.*log' "$SCRIPT"
}

@test "アプリ起動タイムアウト時に exit 1 する" {
  grep -E 'App process did not start|アプリプロセス.*start' "$SCRIPT"
}
