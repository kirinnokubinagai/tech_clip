#!/usr/bin/env bash
# ローカル開発者向け e2e smoke ワンコマンドスクリプト
# 前提条件を確認し、DB リセット + seed 後に Maestro smoke を実行する。
#
# 使用法:
#   bash scripts/e2e/run-local-smoke.sh [flow-path]
#
# 環境変数:
#   TURSO_DATABASE_URL  (デフォルト: http://127.0.0.1:8888)
#   TURSO_AUTH_TOKEN    (デフォルト: dummy)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=../lib/nix.sh
source "${REPO_ROOT}/scripts/lib/nix.sh"
ensure_nix_shell "${REPO_ROOT}" "$@"

FLOW_PATH="${1:-${REPO_ROOT}/tests/e2e/maestro/}"

# --- 色付け ---
if [ -t 1 ]; then
  COLOR_RED="$(tput setaf 1 2>/dev/null || true)"
  COLOR_GREEN="$(tput setaf 2 2>/dev/null || true)"
  COLOR_YELLOW="$(tput setaf 3 2>/dev/null || true)"
  COLOR_RESET="$(tput sgr0 2>/dev/null || true)"
else
  COLOR_RED=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_RESET=""
fi

# --- 前提条件チェック ---
PREREQ_FAILED=0

check_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "${cmd}" > /dev/null 2>&1; then
    echo "${COLOR_RED}ERROR: '${cmd}' が見つかりません${COLOR_RESET}" >&2
    echo "  ${hint}" >&2
    PREREQ_FAILED=1
  fi
}

check_cmd "maestro"  "direnv allow または nix develop を実行してください"
check_cmd "adb"      "Android Studio / Android SDK をインストールしてください"
check_cmd "pnpm"     "nix develop（flake.nix で管理）"
check_cmd "curl"     "curl をインストールしてください"

if [ "${PREREQ_FAILED}" -ne 0 ]; then
  exit 3
fi

# --- Android Emulator 確認 ---
if ! adb devices 2>/dev/null | grep -q "emulator"; then
  echo "${COLOR_YELLOW}WARNING: 起動中の Android Emulator が見つかりません${COLOR_RESET}"
  echo "  Android Studio の AVD Manager からエミュレーターを起動してください"
  echo "  または: \$ANDROID_HOME/emulator/emulator -avd <AVD名>"
  exit 4
fi

# --- e2e 環境リセット ---
echo "[smoke] e2e 環境をリセット中..."
bash "${SCRIPT_DIR}/reset-e2e-env.sh"

# --- adb reverse（Metro / Wrangler dev へのトンネル） ---
echo "[smoke] adb reverse を設定中..."
adb reverse tcp:18787 tcp:18787 2>/dev/null || echo "${COLOR_YELLOW}WARNING: adb reverse 失敗（API サーバーなしで続行）${COLOR_RESET}"
adb reverse tcp:8081 tcp:8081 2>/dev/null || echo "${COLOR_YELLOW}WARNING: adb reverse (Metro) 失敗（Metro 起動後に手動実行してください）${COLOR_RESET}"

# --- Maestro 実行 ---
echo "[smoke] Maestro smoke を実行中..."
echo "  対象: ${FLOW_PATH}"
echo ""

# .env.yaml から --env 引数を組み立てる
MAESTRO_ENV_ARGS=()
ENV_FILE="${REPO_ROOT}/tests/e2e/maestro/.env.yaml"
if [ -f "${ENV_FILE}" ]; then
  while IFS= read -r _line; do
    case "${_line}" in
      ''|'#'*) continue ;;
    esac
    _k="${_line%%:*}"
    _v="${_line#*: }"
    [ -z "${_k}" ] && continue
    MAESTRO_ENV_ARGS+=("--env" "${_k}=${_v}")
  done < "${ENV_FILE}"
fi

# .yaml ファイルのみ対象（.env.yaml を除外）
SMOKE_FLOWS=()
while IFS= read -r _f; do
  SMOKE_FLOWS+=("${_f}")
done < <(find "${FLOW_PATH}" -name "*.yaml" ! -name ".env.yaml" | sort)

if [ "${#SMOKE_FLOWS[@]}" -eq 0 ]; then
  echo "${COLOR_YELLOW}WARNING: smoke flow が見つかりません: ${FLOW_PATH}${COLOR_RESET}"
  exit 5
fi

MAESTRO_EXIT=0
maestro test \
  --include-tags smoke \
  "${MAESTRO_ENV_ARGS[@]}" \
  "${SMOKE_FLOWS[@]}" || MAESTRO_EXIT=$?

echo ""
if [ "${MAESTRO_EXIT}" -eq 0 ]; then
  echo "${COLOR_GREEN}smoke test 成功${COLOR_RESET}"
else
  echo "${COLOR_RED}smoke test 失敗（終了コード: ${MAESTRO_EXIT}）${COLOR_RESET}"
  exit "${MAESTRO_EXIT}"
fi
