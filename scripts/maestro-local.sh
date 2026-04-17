#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_PATH}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# --- 色付け ---
if [ -t 1 ]; then
  COLOR_RED="$(tput setaf 1)"
  COLOR_YELLOW="$(tput setaf 3)"
  COLOR_GREEN="$(tput setaf 2)"
  COLOR_RESET="$(tput sgr0)"
else
  COLOR_RED=""
  COLOR_YELLOW=""
  COLOR_GREEN=""
  COLOR_RESET=""
fi

# --- エラーハンドラ ---
on_error() {
  echo "${COLOR_RED}[maestro-local] エラーが発生しました（行: $1）${COLOR_RESET}" >&2
}
trap 'on_error $LINENO' ERR

# --- バックグラウンドプロセス管理 ---
BUILD_PID=""

cleanup() {
  if [ -n "${BUILD_PID}" ] && kill -0 "${BUILD_PID}" 2>/dev/null; then
    echo "[maestro-local] バックグラウンドビルドプロセスを停止します (PID: ${BUILD_PID})"
    kill "${BUILD_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# --- 使用法 ---
usage() {
  echo "使用法: bash scripts/maestro-local.sh <ios|android> [flow-path]"
  echo ""
  echo "  ios      iOS Simulator でE2Eテストを実行（macOS のみ）"
  echo "  android  Android Emulator でE2Eテストを実行"
  echo ""
  echo "  flow-path  実行する flow のパス（省略時は tests/e2e/maestro/ 全体）"
}

# --- 引数検証 ---
if [ "${#}" -lt 1 ]; then
  echo "${COLOR_RED}エラー: プラットフォームを指定してください${COLOR_RESET}" >&2
  usage >&2
  exit 2
fi

PLATFORM="${1}"
FLOW_PATH="${2:-${REPO_ROOT}/tests/e2e/maestro/}"

if [ "${PLATFORM}" != "ios" ] && [ "${PLATFORM}" != "android" ]; then
  echo "${COLOR_RED}エラー: 不正なプラットフォーム '${PLATFORM}'. 'ios' または 'android' を指定してください${COLOR_RESET}" >&2
  usage >&2
  exit 2
fi

if [ "${PLATFORM}" = "ios" ] && [ "$(uname)" != "Darwin" ]; then
  echo "${COLOR_RED}エラー: iOS E2E は macOS のみサポートされています${COLOR_RESET}" >&2
  exit 2
fi

if [ ! -e "${FLOW_PATH}" ]; then
  echo "${COLOR_RED}エラー: flow パスが見つかりません: ${FLOW_PATH}${COLOR_RESET}" >&2
  exit 2
fi

# --- prereq チェック ---
PREREQ_FAILED=0

check_command() {
  local cmd="$1"
  local install_hint="$2"
  if ! command -v "${cmd}" > /dev/null 2>&1; then
    echo "${COLOR_RED}エラー: '${cmd}' が見つかりません${COLOR_RESET}" >&2
    echo "  インストール方法: ${install_hint}" >&2
    PREREQ_FAILED=1
  fi
}

check_command "pnpm" "nix develop（flake.nix で管理）"
check_command "maestro" "curl -Ls 'https://get.maestro.mobile.dev' | bash"

if [ "${PLATFORM}" = "ios" ]; then
  check_command "xcrun" "Xcode をインストールしてください（App Store または developer.apple.com）"
  check_command "xcodebuild" "Xcode をインストールしてください（App Store または developer.apple.com）"
elif [ "${PLATFORM}" = "android" ]; then
  check_command "adb" "Android Studio / Android SDK をインストールしてください"
  if ! command -v emulator > /dev/null 2>&1; then
    echo "${COLOR_YELLOW}警告: 'emulator' コマンドが PATH に含まれていません（Android Studio から直接起動する場合は問題ありません）${COLOR_RESET}" >&2
  fi
fi

if [ "${PREREQ_FAILED}" -ne 0 ]; then
  exit 3
fi

# --- simulator / emulator 起動確認 ---
if [ "${PLATFORM}" = "ios" ]; then
  if ! xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
    echo "${COLOR_YELLOW}警告: 起動中の iOS Simulator が見つかりません。expo run:ios が自動起動を試みます${COLOR_RESET}"
  fi
elif [ "${PLATFORM}" = "android" ]; then
  if ! adb devices 2>/dev/null | grep -q "emulator"; then
    echo "${COLOR_YELLOW}警告: 起動中の Android Emulator が見つかりません${COLOR_RESET}"
    echo "  Android Studio の AVD Manager から Emulator を起動してください"
    echo "  または: \$ANDROID_HOME/emulator/emulator -avd <AVD名>"
  fi
fi

# --- タイムアウトコマンド検出 ---
TIMEOUT_BUILD_SEC="${MAESTRO_BUILD_TIMEOUT_SEC:-1200}"

find_timeout_cmd() {
  if command -v gtimeout > /dev/null 2>&1; then
    echo "gtimeout"
  elif command -v timeout > /dev/null 2>&1; then
    echo "timeout"
  else
    echo ""
  fi
}

TIMEOUT_CMD="$(find_timeout_cmd)"
if [ -z "${TIMEOUT_CMD}" ]; then
  echo "${COLOR_YELLOW}警告: timeout/gtimeout コマンドが見つかりません。タイムアウトなしで実行します${COLOR_RESET}"
fi

# --- dev client ビルド + 起動 ---
BUILD_LOG="/tmp/maestro-local-${PLATFORM}-build.log"
echo "[maestro-local] ${PLATFORM} dev client をビルド中..."
echo "  ログ: ${BUILD_LOG}"

cd "${REPO_ROOT}/apps/mobile"

if [ "${PLATFORM}" = "ios" ]; then
  if [ -n "${TIMEOUT_CMD}" ]; then
    "${TIMEOUT_CMD}" "${TIMEOUT_BUILD_SEC}" pnpm expo run:ios > "${BUILD_LOG}" 2>&1 &
  else
    pnpm expo run:ios > "${BUILD_LOG}" 2>&1 &
  fi
elif [ "${PLATFORM}" = "android" ]; then
  if [ -n "${TIMEOUT_CMD}" ]; then
    "${TIMEOUT_CMD}" "${TIMEOUT_BUILD_SEC}" pnpm expo run:android --variant debug > "${BUILD_LOG}" 2>&1 &
  else
    pnpm expo run:android --variant debug > "${BUILD_LOG}" 2>&1 &
  fi
fi

BUILD_PID="$!"

cd "${REPO_ROOT}"

# --- アプリ起動待機 ---
APP_ID="${MAESTRO_APP_ID:-com.techclip.app}"
APP_WAIT_MAX_SEC=300
APP_WAIT_INTERVAL=5
APP_WAITED=0

echo "[maestro-local] アプリの起動を待機中..."

while true; do
  if [ "${PLATFORM}" = "ios" ]; then
    SIMULATOR_UDID="$(xcrun simctl list devices booted 2>/dev/null | grep -E '\(Booted\)' | head -1 | grep -oE '[0-9A-F-]{36}')"
    if [ -n "${SIMULATOR_UDID}" ]; then
      _LAUNCHED=0
      for _i in $(seq 1 10); do
        if xcrun simctl spawn "${SIMULATOR_UDID}" launchctl list 2>/dev/null | grep -q "${APP_ID}"; then
          _LAUNCHED=1
          break
        fi
        sleep 1
      done
      if [ "${_LAUNCHED}" -eq 1 ]; then
        echo "${COLOR_GREEN}[maestro-local] iOS アプリが起動しました${COLOR_RESET}"
        break
      fi
    fi
  elif [ "${PLATFORM}" = "android" ]; then
    if adb shell pidof "${APP_ID}" 2>/dev/null | grep -qE '[0-9]+'; then
      echo "${COLOR_GREEN}[maestro-local] Android アプリが起動しました${COLOR_RESET}"
      break
    fi
  fi

  if [ "${APP_WAITED}" -ge "${APP_WAIT_MAX_SEC}" ]; then
    echo "${COLOR_RED}エラー: アプリの起動待機がタイムアウトしました（${APP_WAIT_MAX_SEC}秒）${COLOR_RESET}" >&2
    echo "  ビルドログを確認してください: ${BUILD_LOG}" >&2
    exit 4
  fi

  sleep "${APP_WAIT_INTERVAL}"
  APP_WAITED=$(( APP_WAITED + APP_WAIT_INTERVAL ))
done

# --- Android シャーディング（複数 emulator 対応）---
if [ "${PLATFORM}" = "android" ]; then
  _WORKTREE_HASH="$(echo "${REPO_ROOT}" | shasum -a 256 | cut -c1-8)"
  _EMULATORS=()
  while IFS= read -r _e; do
    _EMULATORS+=("$_e")
  done < <(adb devices 2>/dev/null | grep "emulator" | awk '{print $1}')
  if (( ${#_EMULATORS[@]} > 0 )); then
    _IDX=$(( 16#${_WORKTREE_HASH} % ${#_EMULATORS[@]} ))
    export ANDROID_SERIAL="${_EMULATORS[${_IDX}]}"
    echo "[maestro-local] ANDROID_SERIAL=${ANDROID_SERIAL}（${#_EMULATORS[@]}台中インデックス${_IDX}）"
  fi
fi

# --- Maestro 実行 ---
JUNIT_OUTPUT="/tmp/maestro-result.xml"
DEBUG_OUTPUT="/tmp/maestro-debug"

echo "[maestro-local] Maestro を実行中..."
echo "  対象: ${FLOW_PATH}"

MAESTRO_EXIT=0
maestro test \
  --format junit \
  --output "${JUNIT_OUTPUT}" \
  --debug-output "${DEBUG_OUTPUT}" \
  "${FLOW_PATH}" || MAESTRO_EXIT=$?

# --- 結果サマリー ---
echo ""
echo "===== Maestro 結果サマリー ====="

if [ -f "${JUNIT_OUTPUT}" ]; then
  TOTAL=0
  FAILED=0
  FAILED_NAMES=""

  if command -v xmllint > /dev/null 2>&1; then
    TOTAL="$(xmllint --xpath 'string(//testsuite/@tests)' "${JUNIT_OUTPUT}" 2>/dev/null || echo '0')"
    FAILED="$(xmllint --xpath 'string(//testsuite/@failures)' "${JUNIT_OUTPUT}" 2>/dev/null || echo '0')"
    FAILED_NAMES="$(xmllint --xpath '//testcase[@status="failed"]/@name' "${JUNIT_OUTPUT}" 2>/dev/null | sed 's/name=//g; s/"//g' || true)"
  else
    TOTAL="$(grep -oE 'tests="[0-9]+"' "${JUNIT_OUTPUT}" | head -1 | grep -oE '[0-9]+' || echo '0')"
    FAILED="$(grep -oE 'failures="[0-9]+"' "${JUNIT_OUTPUT}" | head -1 | grep -oE '[0-9]+' || echo '0')"
    FAILED_NAMES="$(grep -oE 'classname="[^"]*" name="[^"]*" status="failed"' "${JUNIT_OUTPUT}" | grep -oE 'name="[^"]*"' | sed 's/name=//g; s/"//g' || true)"
  fi

  PASSED=$(( TOTAL - FAILED ))
  echo "  total:  ${TOTAL}"
  echo "  passed: ${COLOR_GREEN}${PASSED}${COLOR_RESET}"
  if [ "${FAILED}" -gt 0 ]; then
    echo "  failed: ${COLOR_RED}${FAILED}${COLOR_RESET}"
  else
    echo "  failed: ${FAILED}"
  fi

  if [ -n "${FAILED_NAMES}" ]; then
    echo ""
    echo "  失敗した flow:"
    while IFS= read -r _name; do
      [ -n "${_name}" ] && echo "    - ${_name}"
    done <<< "${FAILED_NAMES}"
  fi
else
  echo "  JUnit XML が見つかりません（Maestro が正常に起動しなかった可能性があります）"
fi

echo ""
echo "  JUnit XML:    ${JUNIT_OUTPUT}"
echo "  debug output: ${DEBUG_OUTPUT}"

if [ "${MAESTRO_EXIT}" -ne 0 ]; then
  echo ""
  echo "${COLOR_RED}Maestro が失敗しました（終了コード: ${MAESTRO_EXIT}）${COLOR_RESET}"
  exit 1
fi

echo ""
echo "${COLOR_GREEN}全 flow が成功しました${COLOR_RESET}"
exit 0
