#!/usr/bin/env bash
# run-maestro-and-create-marker.sh: Maestro E2E 実行 → create-e2e-marker.sh 呼び出し
#
# 使い方:
#   bash scripts/gate/run-maestro-and-create-marker.sh --agent <name> [--base-ref <ref>] \
#     [--shard all/<N>] [--device <DEVICE_LIST>]
#
# --device: 単一 (emulator-5554) またはカンマ区切り (emulator-5554,emulator-5556)
#   省略時は adb devices で自動検出:
#     0 台 → エラー終了
#     1 台 → シングル実行
#     2 台以上 → Maestro の --shard-split で並列実行
#
# --shard all/N: N 台での並列実行を明示指定。N が DEVICE_COUNT と一致しない場合エラー終了。
#   省略時は auto-detect で決定。
#
# Maestro --shard-split 方式:
#   単一の maestro test コマンドで --shard-split を使用し、全 flow を並列実行。
#   Maestro Studio / stale CLI を事前に cleanup してから実行。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

AGENT_NAME=""
BASE_REF="origin/main"
SHARD_SPEC=""
DEVICE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)    AGENT_NAME="$2"; shift 2 ;;
    --base-ref) BASE_REF="$2";   shift 2 ;;
    --shard)    SHARD_SPEC="$2"; shift 2 ;;
    --device)   DEVICE="$2";     shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT_NAME" ]; then
  echo "ERROR: --agent <name> is required" >&2
  exit 1
fi

# --shard 検証: all/N のみ許容（INDEX/TOTAL 形式は廃止）
SHARD_TOTAL=1
if [ -n "$SHARD_SPEC" ]; then
  if echo "$SHARD_SPEC" | grep -qE '^all/[1-9][0-9]*$'; then
    SHARD_TOTAL="${SHARD_SPEC#*/}"
  else
    echo "ERROR: invalid --shard spec: '$SHARD_SPEC' (only 'all/N' or omit is accepted)" >&2
    exit 1
  fi
fi

# emulator 確認
if ! command -v maestro &>/dev/null; then
  echo "ERROR: maestro command not found. Install maestro or run via direnv." >&2
  exit 1
fi

MAESTRO_DIR="${REPO_ROOT}/tests/e2e/maestro"
if [ ! -d "$MAESTRO_DIR" ]; then
  echo "ERROR: maestro test directory not found: $MAESTRO_DIR" >&2
  exit 1
fi

# DEVICE 自動検出（空のとき）
if [ -z "$DEVICE" ]; then
  mapfile -t DETECTED < <(adb devices 2>/dev/null \
    | grep -E '^emulator-[0-9]+\s+device' \
    | awk '{print $1}')
  if [ "${#DETECTED[@]}" -eq 0 ]; then
    echo "ERROR: no emulator detected. Start an AVD first." >&2
    exit 1
  fi
  DEVICE="$(IFS=,; echo "${DETECTED[*]}")"
  echo "[gate] --device not specified, auto-detected: $DEVICE" >&2
fi

# DEVICE_COUNT 算出（カンマ区切りの数）
DEVICE_COUNT=$(awk -F, '{print NF}' <<< "$DEVICE")

# --shard all/N 明示時: N と DEVICE_COUNT の整合性チェック（SHARD_TOTAL vs DEVICE_COUNT）
if [ -n "$SHARD_SPEC" ] && [ "$SHARD_TOTAL" -ne "$DEVICE_COUNT" ]; then
  echo "ERROR: --shard all/$SHARD_TOTAL specified but DEVICE_COUNT=$DEVICE_COUNT (mismatch)" >&2
  echo "  DEVICE=$DEVICE" >&2
  exit 1
fi

# ── Maestro Studio / stale CLI プロセス cleanup ──────────────────────────────
_cleanup_maestro_processes() {
  echo "[gate] Maestro Studio / stale CLI を cleanup します..." >&2
  # Maestro Studio server (studio-server.jar)
  pkill -f "studio-server.jar" 2>/dev/null || true
  # stale maestro CLI プロセス（自プロセスは除外）
  local my_pid=$$
  pgrep -f "maestro.cli.AppKt" 2>/dev/null | while read -r pid; do
    [ "$pid" != "$my_pid" ] && kill "$pid" 2>/dev/null || true
  done || true
  # ADB forwarding クリア
  local devs
  devs=$(adb devices 2>/dev/null | grep -E '^emulator-[0-9]+\s+device' | awk '{print $1}')
  for dev in $devs; do
    adb -s "$dev" forward --remove-all 2>/dev/null || true
  done
  sleep 1
}

# ── バックエンド起動チェック（Fix B） ──────────────────────────────────────
# turso (8888) が LISTEN しているか確認。未起動なら up.sh + seed.sh を呼ぶ。
# gate スクリプトが起動したものだけ EXIT 時に down する（開発者の手元 dev shell を kill しない）。
_BACKEND_STARTED_BY_GATE=0

_check_port_listen() {
  lsof -i:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

_backend_down_if_gate_started() {
  if [ "$_BACKEND_STARTED_BY_GATE" -eq 1 ]; then
    echo "[gate] backend を停止します (gate が起動したため)..." >&2
    bash "${REPO_ROOT}/scripts/dev/down.sh" >/dev/null 2>&1 || true
  fi
}

trap '_backend_down_if_gate_started; _cleanup_maestro_processes' EXIT

if ! _check_port_listen 8888; then
  echo "[gate] backend が未起動です。起動します..." >&2
  if ! bash "${REPO_ROOT}/scripts/dev/up.sh"; then
    echo "[gate] ERROR: backend (up.sh) の起動に失敗しました。ログを確認してください:" >&2
    tail -50 /tmp/techclip-dev/api.log 2>/dev/null || true
    exit 1
  fi
  _BACKEND_STARTED_BY_GATE=1
else
  echo "[gate] backend already up, skipping bring-up" >&2
fi

echo "[gate] seed を実行します..." >&2
if ! bash "${REPO_ROOT}/scripts/dev/seed.sh"; then
  echo "[gate] ERROR: seed.sh に失敗しました。" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Maestro cleanup（pm clear 前に実行）
_cleanup_maestro_processes

# app の cache + Keystore を消去する (前回テストの auth token が
# Android Keystore = expo-secure-store に残ると「セッション期限切れ」エラーで
# login が阻害されるため。maestro `clearState: true` は app data のみで Keystore は消えない)
APP_PACKAGE="${SHARD_APP_ID:-com.techclip.app}"
echo "[gate] ${APP_PACKAGE} cache + Keystore を消去 (devices: $DEVICE)..." >&2
IFS=',' read -ra DEVICE_LIST <<< "$DEVICE"
for dev in "${DEVICE_LIST[@]}"; do
  adb -s "$dev" shell pm clear "$APP_PACKAGE" >/dev/null 2>&1 &
done
wait

# YAML ファイル一覧（全 flow）
YAML_FILES=()
while IFS= read -r f; do
  YAML_FILES+=("$f")
done < <(find "$MAESTRO_DIR" -maxdepth 1 -name "*.yaml" ! -name ".env.yaml" ! -name "config.yaml" | sort)

if [ "${#YAML_FILES[@]}" -eq 0 ]; then
  echo "WARNING: no maestro yaml files found in $MAESTRO_DIR" >&2
  bash "${SCRIPT_DIR}/create-e2e-marker.sh" --agent "$AGENT_NAME" --base-ref "$BASE_REF"
  exit 0
fi

RESULT_XML="/tmp/maestro-result-${HEAD_SHA:0:8}-${TIMESTAMP}.xml"

# config.yaml の env: ブロックを --env 引数に展開する
ENV_ARGS=()
CONFIG_FILE="${MAESTRO_DIR}/config.yaml"
if [ -f "$CONFIG_FILE" ]; then
  in_env=0
  while IFS= read -r line; do
    case "$line" in
      env:) in_env=1; continue ;;
      [a-zA-Z]*:) in_env=0; continue ;;
    esac
    if [ "$in_env" -eq 1 ]; then
      case "$line" in
        ''|'#'*) continue ;;
        ' '*)
          stripped="${line#"${line%%[![:space:]]*}"}"
          k="${stripped%%:*}"
          v="${stripped#*: }"
          [ -z "$k" ] && continue
          ENV_ARGS+=("--env" "${k}=${v}")
          ;;
      esac
    fi
  done < "$CONFIG_FILE"
fi
# .env.yaml が存在すれば追加で展開（機密情報の上書き用）
ENV_FILE="${MAESTRO_DIR}/.env.yaml"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    k="${line%%:*}"
    v="${line#*: }"
    [ -z "$k" ] && continue
    ENV_ARGS+=("--env" "${k}=${v}")
  done < "$ENV_FILE"
fi

# Netty (Maestro の gRPC クライアント) が IPv6 で接続しようとするが ADB forwarding は IPv4 のみ。
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djava.net.preferIPv4Stack=true"

mkdir -p "${REPO_ROOT}/.claude"
PROGRESS_FILE="${REPO_ROOT}/.claude/.e2e-progress.json"

if [ "$DEVICE_COUNT" -eq 1 ]; then
  # ── single device: 並列化しない（従来互換）──────────────────────────────
  echo "Running maestro tests: device=$DEVICE count=1 (${#YAML_FILES[@]} flows)" >&2

  DEBUG_DIR="/tmp/maestro-debug-${HEAD_SHA:0:8}-${TIMESTAMP}"
  LOG_FILE="/tmp/maestro-log-${HEAD_SHA:0:8}-${TIMESTAMP}.log"
  mkdir -p "$DEBUG_DIR"

  jq -n \
    --arg log_file "$LOG_FILE" \
    --arg result_xml "$RESULT_XML" \
    --arg debug_dir "$DEBUG_DIR" \
    --argjson device_count "$DEVICE_COUNT" \
    --argjson flow_count "${#YAML_FILES[@]}" \
    --arg status "running" \
    '{log_file: $log_file, result_xml: $result_xml, debug_dir: $debug_dir,
      device_count: $device_count, flow_count: $flow_count, status: $status}' \
    > "$PROGRESS_FILE"

  (cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" maestro test \
    --device "$DEVICE" \
    --format junit \
    --output "$RESULT_XML" \
    --debug-output "$DEBUG_DIR" \
    "${ENV_ARGS[@]}" \
    "${YAML_FILES[@]}" 2>&1) | tee "$LOG_FILE" || true

  jq -n \
    --arg log_file "$LOG_FILE" \
    --arg result_xml "$RESULT_XML" \
    --arg debug_dir "$DEBUG_DIR" \
    --argjson device_count "$DEVICE_COUNT" \
    --argjson flow_count "${#YAML_FILES[@]}" \
    --arg status "completed" \
    '{log_file: $log_file, result_xml: $result_xml, debug_dir: $debug_dir,
      device_count: $device_count, flow_count: $flow_count, status: $status}' \
    > "$PROGRESS_FILE"

  if [ ! -f "$RESULT_XML" ]; then
    echo "ERROR: maestro did not produce result XML: $RESULT_XML" >&2
    exit 1
  fi

  DEBUG_INDEX="${REPO_ROOT}/.claude/.e2e-debug.json"
  jq -n \
    --arg result_xml "$RESULT_XML" \
    --arg debug_dir "$DEBUG_DIR" \
    --arg log_file "$LOG_FILE" \
    --argjson device_count "$DEVICE_COUNT" \
    '{result_xml: $result_xml, debug_dir: $debug_dir, log_file: $log_file, device_count: $device_count}' \
    > "$DEBUG_INDEX"

  bash "${SCRIPT_DIR}/create-e2e-marker.sh" \
    --agent "$AGENT_NAME" \
    --maestro-result "$RESULT_XML" \
    --base-ref "$BASE_REF"
  exit $?
fi

# ── multi-device: --shard-split（Maestro native 並列）──────────────────────────
echo "Running maestro tests: devices=$DEVICE count=$DEVICE_COUNT (${#YAML_FILES[@]} flows) [shard-split]" >&2

DEBUG_DIR="/tmp/maestro-debug-${HEAD_SHA:0:8}-${TIMESTAMP}"
LOG_FILE="/tmp/maestro-log-${HEAD_SHA:0:8}-${TIMESTAMP}.log"
mkdir -p "$DEBUG_DIR"

jq -n \
  --arg log_file "$LOG_FILE" \
  --arg result_xml "$RESULT_XML" \
  --arg debug_dir "$DEBUG_DIR" \
  --argjson device_count "$DEVICE_COUNT" \
  --argjson flow_count "${#YAML_FILES[@]}" \
  --arg status "running" \
  '{log_file: $log_file, result_xml: $result_xml, debug_dir: $debug_dir,
    device_count: $device_count, flow_count: $flow_count, status: $status}' \
  > "$PROGRESS_FILE"

(cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" maestro test \
  --device "$DEVICE" \
  --shard-split "$DEVICE_COUNT" \
  --format junit \
  --output "$RESULT_XML" \
  --debug-output "$DEBUG_DIR" \
  "${ENV_ARGS[@]}" \
  "${YAML_FILES[@]}" 2>&1) | tee "$LOG_FILE" || true

# progress 更新
jq -n \
  --arg log_file "$LOG_FILE" \
  --arg result_xml "$RESULT_XML" \
  --arg debug_dir "$DEBUG_DIR" \
  --argjson device_count "$DEVICE_COUNT" \
  --argjson flow_count "${#YAML_FILES[@]}" \
  --arg status "completed" \
  '{log_file: $log_file, result_xml: $result_xml, debug_dir: $debug_dir,
    device_count: $device_count, flow_count: $flow_count, status: $status}' \
  > "$PROGRESS_FILE"

if [ ! -f "$RESULT_XML" ]; then
  echo "ERROR: maestro did not produce result XML: $RESULT_XML" >&2
  exit 1
fi

DEBUG_INDEX="${REPO_ROOT}/.claude/.e2e-debug.json"
jq -n \
  --arg result_xml "$RESULT_XML" \
  --arg debug_dir "$DEBUG_DIR" \
  --arg log_file "$LOG_FILE" \
  --argjson device_count "$DEVICE_COUNT" \
  '{result_xml: $result_xml, debug_dir: $debug_dir, log_file: $log_file, device_count: $device_count}' \
  > "$DEBUG_INDEX"

bash "${SCRIPT_DIR}/create-e2e-marker.sh" \
  --agent "$AGENT_NAME" \
  --maestro-result "$RESULT_XML" \
  --base-ref "$BASE_REF"
exit $?
