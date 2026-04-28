#!/usr/bin/env bats
# bake-apk-into-avd.sh の bats テスト (#1137)
#
# テスト環境: bats-core
# 実行: bats tests/scripts/dev/bake-apk-into-avd.bats

REAL_SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/../scripts/dev/bake-apk-into-avd.sh"

setup() {
  TEST_TMP="$(mktemp -d)"
  export TEST_TMP
  export ANDROID_AVD_HOME="$TEST_TMP/avd"
  mkdir -p "$ANDROID_AVD_HOME/techclip-test.avd"

  # ダミー APK ファイル作成
  mkdir -p "$TEST_TMP/apk"
  echo "dummy-apk-content" > "$TEST_TMP/apk/dummy.apk"

  # スタブ bin dir
  mkdir -p "$TEST_TMP/bin"

  # ANDROID_HOME スタブ
  export ANDROID_HOME="$TEST_TMP/android"
  mkdir -p "$ANDROID_HOME/emulator"

  # emulator スタブ: -list-avds で techclip-test を返す、起動は即座に exit
  cat > "$ANDROID_HOME/emulator/emulator" <<'STUB'
#!/usr/bin/env bash
if [[ "$*" == *"-list-avds"* ]]; then
  echo "techclip-test"
  exit 0
fi
# 起動コマンドは background nohup で呼ばれるため、即 exit して良い
exit 0
STUB
  chmod +x "$ANDROID_HOME/emulator/emulator"

  # adb スタブ (デフォルト: boot=1, am start 成功, focus あり, pidof あり, snapshot save 成功)
  cat > "$TEST_TMP/bin/adb" <<'STUB'
#!/usr/bin/env bash
# adb -s emulator-PORT <subcmd> ...
case "$*" in
  *"emu kill"*)
    exit 0 ;;
  *"getprop sys.boot_completed"*)
    echo "1" ;;
  *"push "*"/data/local/tmp/"*)
    exit 0 ;;
  *"pm install"*)
    exit 0 ;;
  *"am start"*)
    exit 0 ;;
  *"dumpsys window windows"*)
    echo "  mCurrentFocus=Window{abc com.techclip.app/.MainActivity}" ;;
  *"pidof"*)
    echo "12345" ;;
  *"emu avd snapshot save"*)
    exit 0 ;;
  *)
    exit 0 ;;
esac
STUB
  chmod +x "$TEST_TMP/bin/adb"

  # shasum スタブ: 常に固定 hash を返す
  cat > "$TEST_TMP/bin/shasum" <<'STUB'
#!/usr/bin/env bash
echo "abcdef1234567890  $2"
STUB
  chmod +x "$TEST_TMP/bin/shasum"

  # nohup スタブ: 即 exit
  cat > "$TEST_TMP/bin/nohup" <<'STUB'
#!/usr/bin/env bash
"$@" &
STUB
  chmod +x "$TEST_TMP/bin/nohup"

  export PATH="$TEST_TMP/bin:$PATH"
  export BAKE_PORT="5598"
  export BAKE_APP_SETTLE_SECONDS="0"  # テスト中は sleep を 0 に
}

teardown() {
  rm -rf "$TEST_TMP"
}

run_bake() {
  bash "$REAL_SCRIPT" "techclip-test" "$TEST_TMP/apk/dummy.apk"
}

# -----------------------------------------------------------------------
# cache hit テスト
# -----------------------------------------------------------------------

@test "cache hit: app-state marker 存在で skip されること" {
  # Arrange: shasum スタブは "abcdef1234567890" を返し、head -c 16 で 16 文字になる
  touch "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-app-state-abcdef1234567890"

  # Act
  run run_bake

  # Assert
  [ "$status" -eq 0 ]
  [[ "$output" =~ "cache hit" ]]
}

# -----------------------------------------------------------------------
# 新 marker 名テスト
# -----------------------------------------------------------------------

@test "新版 marker 名は app-state suffix を持つこと" {
  # Act
  run run_bake

  # Assert
  [ "$status" -eq 0 ]
  local marker_count
  marker_count=$(ls "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-app-state-"* 2>/dev/null | wc -l)
  [ "$marker_count" -ge 1 ]
}

@test "旧 marker (.apk-baked-HASH) は存在しないこと" {
  # Act
  run run_bake

  # Assert
  [ "$status" -eq 0 ]
  local old_markers
  old_markers=$(ls "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-abcdef"* 2>/dev/null | grep -v "app-state" | wc -l)
  [ "$old_markers" -eq 0 ]
}

# -----------------------------------------------------------------------
# 旧 marker 削除テスト
# -----------------------------------------------------------------------

@test "旧 marker 形式 (.apk-baked-OLDHASH) が存在すると削除して再 bake されること" {
  # Arrange
  touch "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-OLDHASH"

  # Act
  run run_bake

  # Assert
  [ "$status" -eq 0 ]
  [ ! -f "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-OLDHASH" ]
  local new_marker_count
  new_marker_count=$(ls "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-app-state-"* 2>/dev/null | wc -l)
  [ "$new_marker_count" -ge 1 ]
}

# -----------------------------------------------------------------------
# am start 失敗 fallback テスト
# -----------------------------------------------------------------------

@test "am start 失敗時は install のみ状態で snapshot save されること" {
  # Arrange: am start を失敗させる
  cat > "$TEST_TMP/bin/adb" <<'STUB'
#!/usr/bin/env bash
case "$*" in
  *"emu kill"*)
    exit 0 ;;
  *"getprop sys.boot_completed"*)
    echo "1" ;;
  *"push "*"/data/local/tmp/"*)
    exit 0 ;;
  *"pm install"*)
    exit 0 ;;
  *"am start"*)
    exit 1 ;;
  *"emu avd snapshot save"*)
    exit 0 ;;
  *)
    exit 0 ;;
esac
STUB
  chmod +x "$TEST_TMP/bin/adb"

  # Act
  run run_bake

  # Assert
  [ "$status" -eq 0 ]
  [[ "$output" =~ "am start に失敗" ]]
  # snapshot 保存は続行されているのでマーカーは作成される
  local marker_count
  marker_count=$(ls "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-app-state-"* 2>/dev/null | wc -l)
  [ "$marker_count" -ge 1 ]
}

# -----------------------------------------------------------------------
# snapshot save 失敗テスト
# -----------------------------------------------------------------------

@test "snapshot save 失敗時は cache marker を作らず exit 1 になること" {
  # Arrange: snapshot save を失敗させる
  cat > "$TEST_TMP/bin/adb" <<'STUB'
#!/usr/bin/env bash
case "$*" in
  *"emu kill"*)
    exit 0 ;;
  *"getprop sys.boot_completed"*)
    echo "1" ;;
  *"push "*"/data/local/tmp/"*)
    exit 0 ;;
  *"pm install"*)
    exit 0 ;;
  *"am start"*)
    exit 0 ;;
  *"dumpsys window windows"*)
    echo "  mCurrentFocus=Window{abc com.techclip.app/.MainActivity}" ;;
  *"pidof"*)
    echo "12345" ;;
  *"emu avd snapshot save"*)
    exit 1 ;;
  *)
    exit 0 ;;
esac
STUB
  chmod +x "$TEST_TMP/bin/adb"

  # Act
  run run_bake

  # Assert
  [ "$status" -eq 1 ]
  local marker_count
  marker_count=$(ls "$ANDROID_AVD_HOME/techclip-test.avd/.apk-baked-app-state-"* 2>/dev/null | wc -l)
  [ "$marker_count" -eq 0 ]
}

# -----------------------------------------------------------------------
# app foreground 確認テスト
# -----------------------------------------------------------------------

@test "app foreground 到達を確認してから snapshot save されること" {
  # Act
  run run_bake

  # Assert
  [ "$status" -eq 0 ]
  [[ "$output" =~ "app foreground 到達" ]]
  [[ "$output" =~ "app 起動済み state を確認" ]]
}
