#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/run-android-e2e.sh"
AUTH_REGISTER_FLOW="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/tests/e2e/maestro/02-auth-register.yaml"
LOGIN_HELPER="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/tests/e2e/maestro/helpers/login-helper.yaml"

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

@test "Gradle ビルド + pidof + Metro の 3 フェーズタイムアウトを持つこと" {
  # Arrange: スクリプトに各フェーズのタイムアウトが存在すること
  # Act: grep でパターンを検索
  # Assert: 3 つのタイムアウト変数が存在すること
  grep -E 'MAX_GRADLE_WAIT=' "$SCRIPT"
  grep -E 'MAX_PIDOF_WAIT=' "$SCRIPT"
  grep -E 'MAX_METRO_WAIT=' "$SCRIPT"
}

@test "pidof com.techclip.app でアプリ起動後の安全確認をすること" {
  # Arrange: スクリプトに安全確認の pidof チェックが存在すること
  # Act: grep でパターンを検索
  # Assert: 該当行が存在すること（ループ外の安全確認）
  grep -E 'pidof com\.techclip\.app' "$SCRIPT"
}

@test "EXPO_LOG ファイルに tee してログを収集する" {
  grep -E 'EXPO_LOG' "$SCRIPT"
  grep -E 'tee.*EXPO_LOG|tee.*expo' "$SCRIPT"
}

@test "EXPO_PID は tee ではなく Expo producer を追跡すること" {
  grep -Fq '> >(tee "$EXPO_LOG") 2>&1 &' "$SCRIPT"
  ! grep -Fq '2>&1 | tee "$EXPO_LOG" &' "$SCRIPT"
}

@test "Phase 1 は Metro 完了を Gradle 完了条件として扱わないこと" {
  ! grep -Fq 'BUILD SUCCESSFUL|Bundled' "$SCRIPT"
}

@test "Metro 待機は 120 秒上限の 1 秒ポーリングであること" {
  local metro_poll
  metro_poll="$(awk '
    /^# Phase 3:/ { found = 1 }
    found { print }
    found && /^done$/ { exit }
  ' "$SCRIPT")"

  grep -Eq '^MAX_METRO_WAIT=120([[:space:]]|$)' "$SCRIPT"
  [[ "$metro_poll" == *'while [ $METRO_WAITED -lt $MAX_METRO_WAIT ]; do'* ]]
  [[ "$metro_poll" == *'sleep 1'* ]]
  [[ "$metro_poll" == *'METRO_WAITED=$((METRO_WAITED + 1))'* ]]
}

@test "Metro 待機は apps/mobile/index.js のメイン bundle 完了だけを検知すること" {
  grep -Fq 'if grep -qE "Bundled .*apps/mobile/index\.js" "$EXPO_LOG" 2>/dev/null; then' "$SCRIPT"
}

@test "Metro bundle gate は readiness 通知と Maestro 起動より前にあること" {
  local pidof_timeout_line metro_gate_line ready_line maestro_line
  pidof_timeout_line="$(grep -nF 'if [ $PIDOF_WAITED -ge $MAX_PIDOF_WAIT ]; then' "$SCRIPT" | cut -d: -f1)"
  metro_gate_line="$(grep -nF 'if grep -qE "Bundled .*apps/mobile/index\.js"' "$SCRIPT" | cut -d: -f1)"
  ready_line="$(grep -nF 'App is running, ready to start Maestro tests' "$SCRIPT" | cut -d: -f1)"
  maestro_line="$(grep -nF 'nix develop .#ci --command maestro test' "$SCRIPT" | cut -d: -f1)"

  [ -n "$pidof_timeout_line" ]
  [ -n "$metro_gate_line" ]
  [ "$pidof_timeout_line" -lt "$metro_gate_line" ]
  [ "$metro_gate_line" -lt "$ready_line" ]
  [ "$metro_gate_line" -lt "$maestro_line" ]
}

@test "02-auth-register は最初の cold-start 待機で onboarding ID を 120 秒待つこと" {
  local first_wait
  first_wait="$(awk '
    /^- extendedWaitUntil:/ && !found { found = 1 }
    found { print }
    found && /timeout:/ { exit }
  ' "$AUTH_REGISTER_FLOW")"

  [[ "$first_wait" == *'id: "onboarding-title"'* ]]
  [[ "$first_wait" == *'timeout: 120000'* ]]
}

@test "login-helper は semantic route ID のいずれかを cold-start で 120 秒待つこと" {
  local cold_start_wait
  cold_start_wait="$(awk '
    /# Metro cold-start/ { found = 1 }
    found { print }
    found && /timeout:/ { exit }
  ' "$LOGIN_HELPER")"

  [[ "$cold_start_wait" == *'- extendedWaitUntil:'* ]]
  [[ "$cold_start_wait" == *'id: "onboarding-title|register-email-input|login-email-input|feed-mode-toggle"'* ]]
  [[ "$cold_start_wait" == *'timeout: 120000'* ]]
}

@test "login-helper は home readiness を feed-mode-toggle ID で確認すること" {
  local home_wait
  home_wait="$(awk '
    /# ホーム画面ロード完了待ち/ { found = 1 }
    found { print }
  ' "$LOGIN_HELPER")"

  [[ "$home_wait" == *'id: "feed-mode-toggle"'* ]]
  [[ "$home_wait" == *'timeout: 30000'* ]]
  [[ "$home_wait" != *'text: "すべて"'* ]]
}

@test "x86_64 アーキテクチャのみビルドすること" {
  # Arrange: CI エミュレーターは x86_64 のみサポート
  # Act: grep で ORG_GRADLE_PROJECT_reactNativeArchitectures の存在確認
  # Assert: x86_64 に絞るエクスポートが存在すること
  grep -E 'ORG_GRADLE_PROJECT_reactNativeArchitectures' "$SCRIPT"
}

@test "アプリ起動タイムアウト時に exit 1 する" {
  grep -E 'App process not found|did not complete within|did not start' "$SCRIPT"
}

@test "ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64 を nix develop 内に直接指定する" {
  # export だけでは nix develop --command bash -c に伝播しないため、bash -c 文字列内に含める必要がある
  grep -E "nix develop.*ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64" "$SCRIPT"
}

@test "E2E の内部コマンドは専用 CI dev shell を使う" {
  run bash -c '! grep -q "nix develop --command" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
