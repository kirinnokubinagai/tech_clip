#!/usr/bin/env bash
# setup-avd.sh: nix 由来の Android system image から AVD を自動作成する
#
# 使い方:
#   bash scripts/dev/setup-avd.sh [AVD_NAME]
#
# 動作:
#   - ANDROID_HOME / ANDROID_AVD_HOME を nix devShell から取得
#   - 既に AVD_NAME が存在すれば何もしない
#   - 無ければ avdmanager で system-images;android-34;google_apis;<HOST_ABI> から作成
#
# AVD は ANDROID_AVD_HOME (デフォルト ~/.android-nix/avd) に保存される。
# Android Studio の ~/.android/avd とは独立しており、nix store の system image を参照する。
set -euo pipefail

AVD_NAME="${1:-techclip-test}"

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME が設定されていません。nix develop で shell に入ってください。" >&2
  exit 1
fi

# AVD 保存先 (nix-pure: Android Studio の ~/.android/avd は使わない)
ANDROID_AVD_HOME="${ANDROID_AVD_HOME:-${HOME}/.android-nix/avd}"
mkdir -p "$ANDROID_AVD_HOME"
export ANDROID_AVD_HOME

if ! command -v avdmanager >/dev/null 2>&1; then
  echo "ERROR: avdmanager が PATH に見つかりません。nix devShell で実行してください。" >&2
  exit 1
fi
AVDMANAGER="$(command -v avdmanager)"

# 既存 AVD があれば skip
if "$AVDMANAGER" list avd 2>/dev/null | grep -qE "Name:\s+${AVD_NAME}\b"; then
  echo "[setup-avd] AVD '${AVD_NAME}' は既に存在します (再利用)" >&2
  exit 0
fi

# ABI 決定 (host が darwin-aarch64 なら arm64-v8a, それ以外は x86_64)
case "$(uname -sm)" in
  Darwin\ arm64) ABI="arm64-v8a" ;;
  *)             ABI="x86_64" ;;
esac

SYSIMG="system-images;android-34;google_apis;${ABI}"

# system image が nix store に存在するか確認
SYSIMG_DIR="${ANDROID_HOME}/system-images/android-34/google_apis/${ABI}"
if [ ! -d "$SYSIMG_DIR" ]; then
  echo "ERROR: nix store に system image が見つかりません: $SYSIMG_DIR" >&2
  echo "       flake.nix の androidComposition に systemImageTypes / abiVersions が正しく設定されているか確認してください。" >&2
  exit 1
fi

echo "[setup-avd] AVD '${AVD_NAME}' を作成中 (system-image: ${SYSIMG})..." >&2

# avdmanager は対話入力 (custom hardware profile?) を要求するので no をパイプする
echo "no" | "$AVDMANAGER" create avd \
  --name "$AVD_NAME" \
  --package "$SYSIMG" \
  --device "pixel" \
  --force >&2

echo "[setup-avd] AVD '${AVD_NAME}' を作成しました (path: ${ANDROID_AVD_HOME}/${AVD_NAME}.avd)" >&2

# 作成された AVD のリストを stdout に流す
"$AVDMANAGER" list avd 2>/dev/null | grep -E '^\s+Name:' | awk '{print $2}'
