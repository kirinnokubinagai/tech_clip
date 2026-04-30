#!/usr/bin/env bash
# start-emulator.sh: CI runner で nix 由来の Android emulator を起動する
#
# 使い方:
#   bash scripts/ci/start-emulator.sh [AVD_NAME] [PORT]
#
# 動作:
#   1. setup-avd.sh で nix 由来 system image から AVD 作成 (既存なら skip)
#   2. emulator をヘッドレス起動 (バックグラウンド)
#   3. boot 完了を待機 (最大 8 分)
#   4. emulator PID を /tmp/emulator-${PORT}.pid に保存
#
# 終了させたい場合:
#   adb -s emulator-${PORT} emu kill
#   または kill $(cat /tmp/emulator-${PORT}.pid)
set -euo pipefail

AVD_NAME="${1:-techclip-ci}"
PORT="${2:-5554}"

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME が未設定。nix develop --command bash $0 ... で実行してください" >&2
  exit 1
fi

EMU_BIN="${ANDROID_HOME}/emulator/emulator"
if [ ! -x "$EMU_BIN" ]; then
  echo "ERROR: emulator binary not found: $EMU_BIN" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# AVD 作成 (既存なら skip)
bash "${REPO_ROOT}/scripts/dev/setup-avd.sh" "$AVD_NAME"

# AVD_HOME を export しておく
export ANDROID_AVD_HOME="${ANDROID_AVD_HOME:-${HOME}/.android-nix/avd}"

LOG="/tmp/emulator-${PORT}.log"
PID_FILE="/tmp/emulator-${PORT}.pid"

echo "[start-emulator] starting emulator-${PORT} (AVD=${AVD_NAME})..."
nohup "$EMU_BIN" -avd "$AVD_NAME" \
  -port "$PORT" \
  -no-snapshot-save -no-snapshot-load \
  -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect \
  -accel auto \
  > "$LOG" 2>&1 &

EMU_PID=$!
echo "$EMU_PID" > "$PID_FILE"
echo "[start-emulator] PID=$EMU_PID log=$LOG"

# boot 完了を待機 (最大 8 分)
DEADLINE=$(($(date +%s) + 480))
while true; do
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "ERROR: emulator-${PORT} boot timeout (8min)" >&2
    tail -30 "$LOG" >&2
    exit 1
  fi
  if ! kill -0 "$EMU_PID" 2>/dev/null; then
    echo "ERROR: emulator process died unexpectedly (PID=$EMU_PID)" >&2
    tail -30 "$LOG" >&2
    exit 1
  fi
  BOOT=$(adb -s "emulator-${PORT}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || echo "")
  if [ "$BOOT" = "1" ]; then
    break
  fi
  sleep 5
done

echo "[start-emulator] emulator-${PORT} boot 完了"
adb -s "emulator-${PORT}" shell input keyevent 82 2>/dev/null || true
adb -s "emulator-${PORT}" shell settings put system screen_off_timeout 2147483647 2>/dev/null || true
