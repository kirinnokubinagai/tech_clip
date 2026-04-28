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
CACHE_MARKER="${AVD_DIR}/.apk-baked-${APK_HASH}"

if [ -f "$CACHE_MARKER" ]; then
  echo "[bake] cache hit (apk hash ${APK_HASH}) → skip" >&2
  exit 0
fi

# 古い marker を削除 (apk hash が変わった = apk を更新した)
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

# snapshot 保存して emulator 停止
# emulator emu avd snapshot save <name> でスナップショット保存
adb -s "emulator-${PORT}" emu avd snapshot save default_boot 2>/dev/null || true
sleep 2

# 通常停止 (snapshot 保存込み)
adb -s "emulator-${PORT}" emu kill 2>/dev/null || true
# 念のため process kill (タイムアウト時のため)
sleep 5
kill -9 "$EMU_PID" 2>/dev/null || true

# cache marker 書き込み
printf '%s\n' "$APK_HASH" > "$CACHE_MARKER"
echo "[bake] cache marker 作成: $CACHE_MARKER" >&2
echo "[bake] 完了。以降 launch-shard-emulators.sh は app install を skip できます" >&2
