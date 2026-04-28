#!/usr/bin/env bash
# run-maestro-and-create-marker.sh: Maestro E2E 実行 → create-e2e-marker.sh 呼び出し
#
# 使い方:
#   bash scripts/gate/run-maestro-and-create-marker.sh --agent <name> [--base-ref <ref>] [--shard <N>/<TOTAL>]
#
# --shard を指定した場合:
#   - 該当 shard の flow のみ実行
#   - 結果は /tmp/maestro-result-${SHA8}-${TS}-shard${N}of${TOTAL}.xml として保存
#   - .claude/.e2e-shard-${N}of${TOTAL}.json に shard 単位の結果を書き出す（aggregate-e2e-shards.sh で集約）
#   - 全 shard が揃うのを待つのは呼び出し側の責任
#
# --shard 省略時 (= --shard 1/1):
#   - 全 flow を実行
#   - 直接 .claude/.e2e-passed marker を生成 (create-e2e-marker.sh 経由)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

AGENT_NAME=""
BASE_REF="origin/main"
SHARD_SPEC=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)    AGENT_NAME="$2"; shift 2 ;;
    --base-ref) BASE_REF="$2";   shift 2 ;;
    --shard)    SHARD_SPEC="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT_NAME" ]; then
  echo "ERROR: --agent <name> is required" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

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

# shard 指定なし → emulator 数を自動検出して maestro --shard-split で並列実行する
# (CI matrix では --shard 1/2 + --shard 2/2 のように呼び出し側が分散させるが、
#  ローカル開発者は本 script を 1 回呼んだだけで全 emulator を活用したい)
if [ -z "$SHARD_SPEC" ]; then
  EMU_COUNT=$(adb devices 2>/dev/null | grep -cE '^emulator-[0-9]+\s+device' || echo 0)
  if [ "$EMU_COUNT" -gt 1 ]; then
    SHARD_SPEC="all/${EMU_COUNT}"
    echo "[gate] no --shard; auto-detected ${EMU_COUNT} emulators → using --shard-split ${EMU_COUNT}" >&2
  else
    SHARD_SPEC="1/1"
  fi
fi

SHARD_MODE="single"  # "single" | "all"
if echo "$SHARD_SPEC" | grep -qE '^all/[1-9][0-9]*$'; then
  SHARD_MODE="all"
  SHARD_INDEX="all"
  SHARD_TOTAL="${SHARD_SPEC#*/}"
elif echo "$SHARD_SPEC" | grep -qE '^[1-9][0-9]*/[1-9][0-9]*$'; then
  SHARD_INDEX="${SHARD_SPEC%/*}"
  SHARD_TOTAL="${SHARD_SPEC#*/}"
else
  echo "ERROR: invalid --shard spec: $SHARD_SPEC (expected: <INDEX>/<TOTAL> or all/<TOTAL>)" >&2
  exit 1
fi

# 担当 yaml を取得 (all mode は全 yaml、maestro が --shard-split で内部分割)
YAML_FILES=()
if [ "$SHARD_MODE" = "all" ]; then
  while IFS= read -r f; do
    YAML_FILES+=("$f")
  done < <(find "$MAESTRO_DIR" -maxdepth 1 -name "*.yaml" ! -name ".env.yaml" ! -name "config.yaml" | sort)
else
  while IFS= read -r f; do
    [ -n "$f" ] && YAML_FILES+=("$f")
  done < <(bash "${REPO_ROOT}/scripts/ci/shard-flows.sh" --shard "$SHARD_SPEC" --dir "$MAESTRO_DIR")
fi

if [ "${#YAML_FILES[@]}" -eq 0 ]; then
  echo "WARNING: no maestro yaml files for shard $SHARD_SPEC" >&2
  if [ "$SHARD_TOTAL" -eq 1 ]; then
    # 全 shard で 0 件 → e2e gate を skip 扱い
    bash "${SCRIPT_DIR}/create-e2e-marker.sh" --agent "$AGENT_NAME" --base-ref "$BASE_REF"
    exit 0
  fi
  # 多シャードでこの shard だけ 0 件 (例: TOTAL > flow 数) は意味なしだが PASS 扱いで続行
fi

if [ "$SHARD_TOTAL" -eq 1 ] || [ "$SHARD_MODE" = "all" ]; then
  RESULT_XML="/tmp/maestro-result-${HEAD_SHA:0:8}-${TIMESTAMP}.xml"
else
  RESULT_XML="/tmp/maestro-result-${HEAD_SHA:0:8}-${TIMESTAMP}-shard${SHARD_INDEX}of${SHARD_TOTAL}.xml"
fi

if [ "$SHARD_MODE" = "all" ]; then
  echo "Running maestro tests: --shard-split ${SHARD_TOTAL} (${#YAML_FILES[@]} flows in parallel)" >&2
else
  echo "Running maestro tests: shard ${SHARD_SPEC} (${#YAML_FILES[@]} flows)" >&2
fi

# config.yaml の env: ブロックを --env 引数に展開する。
# (--shard-split / 多 yaml 渡しでは maestro が config.yaml の env を自動マージ
#  しないため、各 flow yaml の `${TEST_EMAIL}` 等を解決するために明示渡し必要)
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
# .env.yaml が存在すれば追加で展開 (機密情報の上書き用)
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

# debug-output / screenshot は per-flow に保存して triage を容易にする
DEBUG_DIR="/tmp/maestro-debug-${HEAD_SHA:0:8}-${TIMESTAMP}-shard${SHARD_INDEX}of${SHARD_TOTAL}"
mkdir -p "$DEBUG_DIR"

# all mode は --shard-split で maestro 内部並列、single mode は全 flow を順次実行
SHARD_SPLIT_ARGS=()
if [ "$SHARD_MODE" = "all" ] && [ "$SHARD_TOTAL" -gt 1 ]; then
  SHARD_SPLIT_ARGS+=("--shard-split" "$SHARD_TOTAL")
fi

(cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" maestro test \
  "${SHARD_SPLIT_ARGS[@]}" \
  --format junit \
  --output "$RESULT_XML" \
  --debug-output "$DEBUG_DIR" \
  "${ENV_ARGS[@]}" \
  "${YAML_FILES[@]}" 2>&1) || true  # exit code は XML の内容で判定するため無視

if [ ! -f "$RESULT_XML" ]; then
  echo "ERROR: maestro did not produce result XML: $RESULT_XML" >&2
  exit 1
fi

# debug-output の場所を triage script で参照できるよう metadata に書き出す
mkdir -p "${REPO_ROOT}/.claude"
DEBUG_INDEX_NAME="${SHARD_INDEX}of${SHARD_TOTAL}"
DEBUG_INDEX="${REPO_ROOT}/.claude/.e2e-debug-shard${DEBUG_INDEX_NAME}.json"
SHARD_INDEX_JSON="$SHARD_INDEX"
[ "$SHARD_INDEX" = "all" ] && SHARD_INDEX_JSON='"all"' || SHARD_INDEX_JSON="$SHARD_INDEX"
jq -n \
  --arg result_xml "$RESULT_XML" \
  --arg debug_dir "$DEBUG_DIR" \
  --arg shard_index "$SHARD_INDEX" \
  --argjson shard_total "$SHARD_TOTAL" \
  '{result_xml: $result_xml, debug_dir: $debug_dir, shard_index: $shard_index, shard_total: $shard_total}' \
  > "$DEBUG_INDEX"

# 単一シャード or all mode (= 内部 --shard-split 並列) はそのまま marker 作成
if [ "$SHARD_TOTAL" -eq 1 ] || [ "$SHARD_MODE" = "all" ]; then
  bash "${SCRIPT_DIR}/create-e2e-marker.sh" \
    --agent "$AGENT_NAME" \
    --maestro-result "$RESULT_XML" \
    --base-ref "$BASE_REF"
  exit $?
fi

# 多シャード: shard 単位の結果を JSON で .claude/ に書き出す
SHARD_JSON="${REPO_ROOT}/.claude/.e2e-shard-${SHARD_INDEX}of${SHARD_TOTAL}.json"
mkdir -p "${REPO_ROOT}/.claude"

FLOWS_TOTAL=$(grep -oE 'tests="[0-9]+"' "$RESULT_XML" | head -1 | grep -oE '[0-9]+' || echo 0)
FLOWS_FAILED=$(grep -oE 'failures="[0-9]+"' "$RESULT_XML" | head -1 | grep -oE '[0-9]+' || echo 0)
FLOWS_ERRORS=$(grep -oE 'errors="[0-9]+"' "$RESULT_XML" | head -1 | grep -oE '[0-9]+' || echo 0)
FLOWS_PASSED=$((FLOWS_TOTAL - FLOWS_FAILED - FLOWS_ERRORS))
COMPLETED_AT=$(date -u +%FT%TZ)

if [ "$FLOWS_FAILED" -ne 0 ] || [ "$FLOWS_ERRORS" -ne 0 ]; then
  STATUS="FAIL"
else
  STATUS="PASS"
fi

jq -n \
  --arg head_sha "$HEAD_SHA" \
  --arg agent "$AGENT_NAME" \
  --arg completed_at "$COMPLETED_AT" \
  --arg log_path "$RESULT_XML" \
  --arg status "$STATUS" \
  --argjson shard_index "$SHARD_INDEX" \
  --argjson shard_total "$SHARD_TOTAL" \
  --argjson flows_passed "$FLOWS_PASSED" \
  --argjson flows_total "$FLOWS_TOTAL" \
  --argjson flows_failed "$FLOWS_FAILED" \
  --argjson flows_errors "$FLOWS_ERRORS" \
  '{
    head_sha: $head_sha,
    agent: $agent,
    completed_at: $completed_at,
    log_path: $log_path,
    status: $status,
    shard_index: $shard_index,
    shard_total: $shard_total,
    flows_passed: $flows_passed,
    flows_total: $flows_total,
    flows_failed: $flows_failed,
    flows_errors: $flows_errors
  }' > "$SHARD_JSON"

echo "shard result written: $SHARD_JSON (status=$STATUS flows=$FLOWS_PASSED/$FLOWS_TOTAL)" >&2

if [ "$STATUS" != "PASS" ]; then
  exit 1
fi
