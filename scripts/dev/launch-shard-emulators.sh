#!/usr/bin/env bash
# launch-shard-emulators.sh: maestro --shard-split 用に複数 emulator を確保する
#
# 使い方:
#   bash scripts/dev/launch-shard-emulators.sh [TARGET_COUNT]
#
# 動作:
#   現在 adb で見える emulator の数を数え、TARGET_COUNT 未満なら追加 emulator を
#   バックグラウンドで起動する。起動済みの emulator はそのまま使う。
#   追加 emulator は -read-only フラグで起動するため、既存 emulator のデータと
#   競合しない（同じ AVD でも並列起動可能）。
#
#   起動した追加 emulator の port (5556, 5558, ...) を stdout に 1 行ずつ出力する。
#   呼び出し側はそれを読んで cleanup できる。
#
# 環境変数:
#   ANDROID_HOME / ANDROID_SDK_ROOT: emulator binary 探索に使用 (省略時はデフォルト位置)
#   PRIMARY_AVD: 追加 emulator に使う AVD 名 (省略時は emulator -list-avds の先頭)
#
# 終了時 cleanup:
#   呼び出し側は終了時に以下で起動した emulator を停止する:
#     for port in <出力された port 群>; do adb -s emulator-$port emu kill; done
set -euo pipefail

TARGET_COUNT="${1:-2}"

if ! echo "$TARGET_COUNT" | grep -qE '^[1-9][0-9]*$'; then
  echo "ERROR: TARGET_COUNT must be a positive integer (got: $TARGET_COUNT)" >&2
  exit 1
fi

# emulator binary を探す
EMU_BIN=""
for candidate in \
  "${ANDROID_HOME:-}/emulator/emulator" \
  "${ANDROID_SDK_ROOT:-}/emulator/emulator" \
  "${HOME}/Library/Android/sdk/emulator/emulator" \
  "${HOME}/Android/Sdk/emulator/emulator"; do
  if [ -x "$candidate" ]; then
    EMU_BIN="$candidate"
    break
  fi
done

if [ -z "$EMU_BIN" ]; then
  echo "ERROR: emulator binary not found. ANDROID_HOME or ANDROID_SDK_ROOT を設定してください。" >&2
  exit 1
fi

# 現在の emulator 数を確認
CURRENT_EMULATORS=()
while IFS= read -r line; do
  port=$(echo "$line" | grep -oE 'emulator-[0-9]+' | grep -oE '[0-9]+' || echo "")
  [ -n "$port" ] && CURRENT_EMULATORS+=("$port")
done < <(adb devices 2>/dev/null | grep -E '^emulator-[0-9]+\s+device' || true)

CURRENT_COUNT="${#CURRENT_EMULATORS[@]}"
NEED_LAUNCH=$((TARGET_COUNT - CURRENT_COUNT))

echo "[shard-emu] 既存 emulator: $CURRENT_COUNT 台 (target=$TARGET_COUNT, 追加=$NEED_LAUNCH)" >&2

if [ "$NEED_LAUNCH" -le 0 ]; then
  echo "[shard-emu] 既に十分な emulator が起動済み" >&2
  exit 0
fi

# AVD 名を決定
PRIMARY_AVD="${PRIMARY_AVD:-}"
if [ -z "$PRIMARY_AVD" ]; then
  PRIMARY_AVD=$("$EMU_BIN" -list-avds 2>/dev/null | head -1)
fi

if [ -z "$PRIMARY_AVD" ]; then
  echo "ERROR: 利用可能な AVD が見つかりません。Android Studio で AVD を作成してください。" >&2
  exit 1
fi

echo "[shard-emu] AVD '$PRIMARY_AVD' から $NEED_LAUNCH 台の追加 emulator を起動します" >&2

# 使用可能な port を探す (5554 から偶数で +2)
USED_PORTS=" ${CURRENT_EMULATORS[*]} "
NEXT_PORT=5556
LAUNCHED_PORTS=()

for _ in $(seq 1 "$NEED_LAUNCH"); do
  # 空き port を探す
  while echo "$USED_PORTS" | grep -q " ${NEXT_PORT} "; do
    NEXT_PORT=$((NEXT_PORT + 2))
  done

  if [ "$NEXT_PORT" -gt 5680 ]; then
    echo "ERROR: 利用可能な emulator port が枯渇しました (5554-5680 すべて使用中)" >&2
    exit 1
  fi

  echo "[shard-emu] emulator-${NEXT_PORT} を起動中..." >&2
  LOG_FILE="/tmp/shard-emu-${NEXT_PORT}.log"

  # -read-only: 既存 AVD のデータを変更しない (同 AVD 並列起動を許可)
  # -no-window -no-audio -no-boot-anim: ヘッドレス
  # -no-snapshot-save: 終了時の snapshot 保存をスキップ
  nohup "$EMU_BIN" -avd "$PRIMARY_AVD" \
    -port "$NEXT_PORT" \
    -read-only \
    -no-window -no-audio -no-boot-anim \
    -no-snapshot-save \
    -gpu swiftshader_indirect \
    > "$LOG_FILE" 2>&1 &
  EMU_PID=$!

  echo "[shard-emu] PID=$EMU_PID port=$NEXT_PORT log=$LOG_FILE" >&2

  USED_PORTS="$USED_PORTS ${NEXT_PORT} "
  LAUNCHED_PORTS+=("$NEXT_PORT")
  NEXT_PORT=$((NEXT_PORT + 2))
done

# すべての追加 emulator が boot 完了するまで待機 (最大 5 分)
echo "[shard-emu] emulator boot を待機中 (最大 5 分)..." >&2
WAIT_DEADLINE=$(($(date +%s) + 300))

for port in "${LAUNCHED_PORTS[@]}"; do
  while true; do
    NOW=$(date +%s)
    if [ "$NOW" -ge "$WAIT_DEADLINE" ]; then
      echo "ERROR: emulator-${port} の boot がタイムアウトしました" >&2
      exit 1
    fi
    BOOT_STATUS=$(adb -s "emulator-${port}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || echo "")
    if [ "$BOOT_STATUS" = "1" ]; then
      echo "[shard-emu] emulator-${port} boot 完了" >&2
      break
    fi
    sleep 3
  done
done

echo "[shard-emu] 全 emulator 準備完了" >&2

# stdout: 起動した port を 1 行ずつ
for port in "${LAUNCHED_PORTS[@]}"; do
  echo "$port"
done
