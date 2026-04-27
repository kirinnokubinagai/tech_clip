#!/usr/bin/env bash
# launch-shard-emulators.sh: maestro --shard-split 用に複数 emulator を確保する
#
# 使い方:
#   bash scripts/dev/launch-shard-emulators.sh [TARGET_COUNT]
#
# 動作:
#   現在 adb で見える emulator の数を数え、TARGET_COUNT 未満なら追加 emulator を
#   バックグラウンドで起動する。起動済みの emulator はそのまま使う。
#
#   重要: Android emulator は同一 AVD の writable 多重起動を許可しない (-read-only
#   フラグが必須となるが、それだと apk install ができない)。そのため追加 emulator
#   は AVD を APFS clonefile (cp -c) で複製した独立 AVD で起動する (COW のため
#   実 disk 消費はゼロから始まる)。
#
#   起動した追加 emulator の port (5556, 5558, ...) を stdout に 1 行ずつ出力する。
#   呼び出し側はそれを読んで cleanup できる。
#
# 必須環境変数 (nix devShell が提供):
#   ANDROID_HOME / ANDROID_SDK_ROOT: nix 由来の Android SDK パス
#   PATH に ${ANDROID_HOME}/emulator と ${ANDROID_HOME}/platform-tools が含まれる
#
# 任意環境変数:
#   PRIMARY_AVD: clone 元 AVD 名 (省略時は emulator -list-avds の先頭、無ければ
#                setup-avd.sh で作成された techclip-test を使用)
#   SHARD_AVD_PREFIX: clone した AVD の名前接頭辞 (デフォルト "shard")
#   SHARD_APP_ID: install 確認に使う package name (デフォルト com.techclip.app)
#
# 終了時 cleanup:
#   呼び出し側は終了時に以下で起動した emulator を停止する:
#     for port in <出力された port 群>; do adb -s emulator-$port emu kill; done
#   AVD clone は次回再利用するため自動削除しない。手動削除する場合:
#     rm -rf "$ANDROID_AVD_HOME/${PRIMARY_AVD}_shardN.avd" "$ANDROID_AVD_HOME/${PRIMARY_AVD}_shardN.ini"
set -euo pipefail

TARGET_COUNT="${1:-2}"
SHARD_AVD_PREFIX="${SHARD_AVD_PREFIX:-shard}"

if ! echo "$TARGET_COUNT" | grep -qE '^[1-9][0-9]*$'; then
  echo "ERROR: TARGET_COUNT must be a positive integer (got: $TARGET_COUNT)" >&2
  exit 1
fi

# nix devShell が ANDROID_HOME を設定するので impure path 探索はしない
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME が設定されていません。nix develop で shell に入ってから実行してください。" >&2
  echo "       (もしくは direnv exec . bash scripts/dev/launch-shard-emulators.sh ...)" >&2
  exit 1
fi

EMU_BIN="${ANDROID_HOME}/emulator/emulator"
if [ ! -x "$EMU_BIN" ]; then
  echo "ERROR: emulator binary not found: $EMU_BIN" >&2
  echo "       nix devShell から ANDROID_HOME が正しく解決されていない可能性があります。" >&2
  exit 1
fi

# AVD 保存先: HOME 直下の隠しディレクトリ (nix-purity を保つため Android Studio の
# ~/.android/avd は使わない。ANDROID_AVD_HOME で上書き可能)。
AVD_HOME="${ANDROID_AVD_HOME:-${HOME}/.android-nix/avd}"
mkdir -p "$AVD_HOME"
export ANDROID_AVD_HOME="$AVD_HOME"

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

# clone 元 AVD を決定
PRIMARY_AVD="${PRIMARY_AVD:-}"
if [ -z "$PRIMARY_AVD" ]; then
  PRIMARY_AVD=$("$EMU_BIN" -list-avds 2>/dev/null | head -1)
fi

# AVD が無ければ setup-avd.sh で nix 由来の system image から bootstrap する
if [ -z "$PRIMARY_AVD" ]; then
  echo "[shard-emu] AVD が未作成です。setup-avd.sh で初期 AVD を作成します..." >&2
  SETUP_AVD="$(dirname "$0")/setup-avd.sh"
  if [ ! -x "$SETUP_AVD" ]; then
    echo "ERROR: setup-avd.sh が見つかりません: $SETUP_AVD" >&2
    exit 1
  fi
  bash "$SETUP_AVD" >&2
  PRIMARY_AVD=$("$EMU_BIN" -list-avds 2>/dev/null | head -1)
  if [ -z "$PRIMARY_AVD" ]; then
    echo "ERROR: setup-avd.sh 実行後も AVD が見つかりません。" >&2
    exit 1
  fi
fi

PRIMARY_AVD_INI="${AVD_HOME}/${PRIMARY_AVD}.ini"
if [ ! -f "$PRIMARY_AVD_INI" ]; then
  echo "ERROR: AVD ini ファイルが見つかりません: $PRIMARY_AVD_INI" >&2
  exit 1
fi
# AVD の実ディレクトリは ini の path= から取得 (AVD 名と dir 名は一致しないことがある)
PRIMARY_AVD_DIR=$(grep -E '^path=' "$PRIMARY_AVD_INI" | head -1 | cut -d= -f2-)
if [ -z "$PRIMARY_AVD_DIR" ] || [ ! -d "$PRIMARY_AVD_DIR" ]; then
  echo "ERROR: AVD ディレクトリが見つかりません (ini=${PRIMARY_AVD_INI}, path=${PRIMARY_AVD_DIR})" >&2
  exit 1
fi

echo "[shard-emu] clone 元 AVD: $PRIMARY_AVD" >&2

# AVD clone helper (APFS clonefile を使って高速 COW コピー)
clone_avd() {
  local shard_n="$1"
  local clone_name="${PRIMARY_AVD}_${SHARD_AVD_PREFIX}${shard_n}"
  local clone_dir="${AVD_HOME}/${clone_name}.avd"
  local clone_ini="${AVD_HOME}/${clone_name}.ini"

  if [ -d "$clone_dir" ]; then
    echo "[shard-emu] clone 既存: $clone_name (再利用)" >&2
    echo "$clone_name"
    return 0
  fi

  echo "[shard-emu] clone 中: $PRIMARY_AVD → $clone_name" >&2
  # cp -c: APFS clonefile (COW, 瞬時にコピー)。失敗時は通常コピーに fallback。
  if ! cp -cR "$PRIMARY_AVD_DIR" "$clone_dir" 2>/dev/null; then
    echo "[shard-emu] clonefile 不可。通常コピー (時間がかかります)..." >&2
    cp -R "$PRIMARY_AVD_DIR" "$clone_dir"
  fi

  # ini ファイル作成
  cat > "$clone_ini" <<EOF
avd.ini.encoding=UTF-8
path=${clone_dir}
path.rel=avd/${clone_name}.avd
target=$(grep -E '^target=' "$PRIMARY_AVD_INI" | head -1 | cut -d= -f2)
EOF

  # emu-launch-params の path 参照をクリア (boot 時に再生成される)
  rm -f "${clone_dir}/emu-launch-params.txt"
  rm -f "${clone_dir}/hardware-qemu.ini.lock"
  rm -f "${clone_dir}/multiinstance.lock"

  echo "$clone_name"
}

# 使用可能な port を探す
USED_PORTS=" ${CURRENT_EMULATORS[*]} "
NEXT_PORT=5556
LAUNCHED_PORTS=()
SHARD_INDEX=0

for _ in $(seq 1 "$NEED_LAUNCH"); do
  while echo "$USED_PORTS" | grep -q " ${NEXT_PORT} "; do
    NEXT_PORT=$((NEXT_PORT + 2))
  done

  if [ "$NEXT_PORT" -gt 5680 ]; then
    echo "ERROR: 利用可能な emulator port が枯渇しました" >&2
    exit 1
  fi

  SHARD_INDEX=$((SHARD_INDEX + 1))
  CLONE_NAME=$(clone_avd "$SHARD_INDEX")

  echo "[shard-emu] emulator-${NEXT_PORT} を起動中 (AVD=${CLONE_NAME})..." >&2
  LOG_FILE="/tmp/shard-emu-${NEXT_PORT}.log"

  # clone なので -read-only 不要、apk install 可能
  nohup "$EMU_BIN" -avd "$CLONE_NAME" \
    -port "$NEXT_PORT" \
    -no-snapshot-save -no-snapshot-load \
    -no-window -no-audio -no-boot-anim \
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

echo "[shard-emu] 全 emulator boot 完了" >&2

# app を install (既存 emulator から apk path を取得して新規 emulator に push)
APP_ID="${SHARD_APP_ID:-com.techclip.app}"
APK_PATH=""

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || true)"
for candidate in \
  "${REPO_ROOT}/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk" \
  ; do
  if [ -f "$candidate" ]; then
    APK_PATH="$candidate"
    break
  fi
done

if [ -z "$APK_PATH" ] && [ "${#CURRENT_EMULATORS[@]}" -gt 0 ]; then
  SRC_PORT="${CURRENT_EMULATORS[0]}"
  REMOTE_APK=$(adb -s "emulator-${SRC_PORT}" shell pm path "$APP_ID" 2>/dev/null | head -1 | sed 's/^package://' | tr -d '\r')
  if [ -n "$REMOTE_APK" ]; then
    APK_PATH="/tmp/shard-emu-pulled-${APP_ID}.apk"
    adb -s "emulator-${SRC_PORT}" pull "$REMOTE_APK" "$APK_PATH" >/dev/null 2>&1 || APK_PATH=""
  fi
fi

if [ -n "$APK_PATH" ] && [ -f "$APK_PATH" ]; then
  for port in "${LAUNCHED_PORTS[@]}"; do
    if adb -s "emulator-${port}" shell pm path "$APP_ID" >/dev/null 2>&1; then
      echo "[shard-emu] emulator-${port}: ${APP_ID} 既に install 済み" >&2
      continue
    fi
    echo "[shard-emu] emulator-${port}: ${APP_ID} を install 中..." >&2
    if adb -s "emulator-${port}" install -r "$APK_PATH" >/dev/null 2>&1; then
      echo "[shard-emu] emulator-${port}: install 完了" >&2
    else
      echo "[shard-emu] WARN: emulator-${port} への install に失敗しました ($APK_PATH)" >&2
    fi
  done
else
  echo "[shard-emu] WARN: ${APP_ID} の apk が見つかりません。" >&2
  echo "[shard-emu]       'pnpm expo run:android' で 1 度ビルドしてから再実行してください" >&2
fi

echo "[shard-emu] 全 emulator 準備完了" >&2

# stdout: 起動した port を 1 行ずつ
for port in "${LAUNCHED_PORTS[@]}"; do
  echo "$port"
done
