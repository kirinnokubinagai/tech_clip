#!/usr/bin/env bash
# bake-apk-into-avd.sh: master AVD に apk を pre-install して snapshot 保存する
#
# 使い方:
#   bash scripts/dev/bake-apk-into-avd.sh [AVD_NAME] [APK_PATH]
#
# 動作:
#   1. APK の SHA-256 hash を計算
#   2. master AVD の cache marker (.apk-baked-<HASH>) を確認
#   3. cache hit: skip
#   4. cache miss:
#      - master AVD を boot
#      - apk install (push + pm install)
#      - emulator emu kill (snapshot save 込みで終了)
#      - cache marker を書く
#   5. 以降 launch-shard-emulators.sh が clone する際、各 shard は app pre-install 済み
#
# 環境変数:
#   ANDROID_HOME / ANDROID_AVD_HOME: nix devShell 提供
#
# 高速化効果:
#   - bake 実行: 初回 〜2-3 分 (boot + install + snapshot)
#   - 以降 launcher 実行: clone (cp -cR APFS COW で瞬時) → app 既に install 済み
#   - apk 変更時のみ再 bake (hash 比較で自動判定)
set -euo pipefail

AVD_NAME="${1:-techclip-test}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)"

APK_PATH="${2:-${REPO_ROOT}/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk}"
APP_ID="${SHARD_APP_ID:-com.techclip.app}"

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME 未設定。nix develop 内で実行してください。" >&2
  exit 1
fi

if [ ! -f "$APK_PATH" ]; then
  echo "ERROR: apk が見つかりません: $APK_PATH" >&2
  echo "       'pnpm expo run:android' で 1 度ビルドしてください。" >&2
  exit 1
fi

ANDROID_AVD_HOME="${ANDROID_AVD_HOME:-${HOME}/.android-nix/avd}"
export ANDROID_AVD_HOME

# AVD 不在 → setup-avd.sh で作成
if ! "${ANDROID_HOME}/emulator/emulator" -list-avds 2>/dev/null | grep -q "^${AVD_NAME}$"; then
  echo "[bake] AVD '${AVD_NAME}' が無いので setup-avd.sh で作成..." >&2
  bash "${SCRIPT_DIR}/setup-avd.sh" "$AVD_NAME"
fi

AVD_DIR="${ANDROID_AVD_HOME}/${AVD_NAME}.avd"
if [ ! -d "$AVD_DIR" ]; then
  echo "ERROR: AVD ディレクトリが見つかりません: $AVD_DIR" >&2
  exit 1
fi

# APK hash 計算
APK_HASH=$(shasum -a 256 "$APK_PATH" | awk '{print $1}' | head -c 16)
# app-state suffix で旧 marker (install のみ状態) と区別する (#1137)
CACHE_MARKER="${AVD_DIR}/.apk-baked-app-state-${APK_HASH}"

if [ -f "$CACHE_MARKER" ]; then
  echo "[bake] cache hit (apk hash ${APK_HASH}) → skip" >&2
  exit 0
fi

# 旧 marker を全削除 (install-only 形式 .apk-baked-HASH も含む)
rm -f "${AVD_DIR}/.apk-baked-"*

PORT="${BAKE_PORT:-5598}"  # 通常運用 port (5554-5562) と被らないよう高めに

# 既に同 port で動いてたら kill
adb -s "emulator-${PORT}" emu kill 2>/dev/null || true
sleep 2

EMU_BIN="${ANDROID_HOME}/emulator/emulator"
LOG="/tmp/bake-emu-${PORT}.log"

echo "[bake] master AVD '${AVD_NAME}' を起動中 (port ${PORT})..." >&2
nohup "$EMU_BIN" -avd "$AVD_NAME" \
  -port "$PORT" \
  -no-snapshot-load \
  -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect \
  > "$LOG" 2>&1 &
EMU_PID=$!

# boot 待機 (最大 5 分)
DEADLINE=$(($(date +%s) + 300))
while true; do
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "ERROR: boot timeout" >&2
    kill "$EMU_PID" 2>/dev/null || true
    exit 1
  fi
  if ! kill -0 "$EMU_PID" 2>/dev/null; then
    echo "ERROR: emulator died" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
  BOOT=$(adb -s "emulator-${PORT}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || echo "")
  [ "$BOOT" = "1" ] && break
  sleep 5
done
echo "[bake] boot 完了" >&2

# apk install (push + pm install: streamed install より信頼性が高い)
echo "[bake] apk install: ${APK_PATH} (${APK_HASH})..." >&2
adb -s "emulator-${PORT}" push "$APK_PATH" "/data/local/tmp/baked-${APP_ID}.apk" >/dev/null
adb -s "emulator-${PORT}" shell pm install -r "/data/local/tmp/baked-${APP_ID}.apk" >/dev/null
echo "[bake] install 完了" >&2

# === [#1137] app 起動 → snapshot 焼き込み ===
APP_LAUNCH_TIMEOUT="${BAKE_APP_LAUNCH_TIMEOUT:-30}"
APP_SETTLE_SECONDS="${BAKE_APP_SETTLE_SECONDS:-15}"
APP_LAUNCH_OK=1

echo "[bake] app 起動 (${APP_ID}/.MainActivity)..." >&2
adb -s "emulator-${PORT}" shell am start -W -n "${APP_ID}/.MainActivity" >/dev/null 2>&1 || {
  echo "[bake] WARN: am start に失敗。snapshot 保存は install のみ状態で続行します。" >&2
  APP_LAUNCH_OK=0
}

if [ "$APP_LAUNCH_OK" = "1" ]; then
  # mCurrentFocus / mFocusedApp で foreground 確認 (最大 APP_LAUNCH_TIMEOUT 秒)
  LAUNCH_DEADLINE=$(($(date +%s) + APP_LAUNCH_TIMEOUT))
  while true; do
    if [ "$(date +%s)" -ge "$LAUNCH_DEADLINE" ]; then
      echo "[bake] WARN: app foreground 確認 timeout (${APP_LAUNCH_TIMEOUT}s)。snapshot 保存は process 生存のみで続行" >&2
      break
    fi
    FOCUS=$(adb -s "emulator-${PORT}" shell dumpsys window windows 2>/dev/null \
            | grep -E 'mCurrentFocus|mFocusedApp' | head -2)
    if echo "$FOCUS" | grep -q "${APP_ID}/.MainActivity"; then
      echo "[bake] app foreground 到達" >&2
      break
    fi
    sleep 1
  done

  # onboarding 1 ページ目の描画完了を待つ (固定 sleep)
  echo "[bake] onboarding 描画待機 (${APP_SETTLE_SECONDS}s)..." >&2
  sleep "$APP_SETTLE_SECONDS"

  # process 生存最終確認
  if ! adb -s "emulator-${PORT}" shell pidof "$APP_ID" >/dev/null 2>&1; then
    echo "[bake] WARN: app process が死んでいます。snapshot は install のみ状態で保存" >&2
  else
    echo "[bake] app 起動済み state を確認" >&2
  fi
fi

# snapshot 保存 (失敗時は exit 1、cache marker は作らない)
adb -s "emulator-${PORT}" emu avd snapshot save default_boot 2>/dev/null || {
  echo "[bake] ERROR: snapshot save に失敗" >&2
  adb -s "emulator-${PORT}" emu kill 2>/dev/null || true
  kill -9 "$EMU_PID" 2>/dev/null || true
  exit 1
}
sleep 2

# 通常停止
adb -s "emulator-${PORT}" emu kill 2>/dev/null || true
sleep 5
kill -9 "$EMU_PID" 2>/dev/null || true

# cache marker 書き込み
printf '%s\n' "$APK_HASH" > "$CACHE_MARKER"
echo "[bake] cache marker 作成: $CACHE_MARKER" >&2
echo "[bake] 完了。以降 launch-shard-emulators.sh は app 起動済み snapshot から clone できます" >&2
