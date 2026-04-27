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

# shard 指定なし → 単一シャード扱い
if [ -z "$SHARD_SPEC" ]; then
  SHARD_SPEC="1/1"
fi

if ! echo "$SHARD_SPEC" | grep -qE '^[1-9][0-9]*/[1-9][0-9]*$'; then
  echo "ERROR: invalid --shard spec: $SHARD_SPEC (expected: <INDEX>/<TOTAL>)" >&2
  exit 1
fi

SHARD_INDEX="${SHARD_SPEC%/*}"
SHARD_TOTAL="${SHARD_SPEC#*/}"

# 担当 yaml を取得
YAML_FILES=()
while IFS= read -r f; do
  [ -n "$f" ] && YAML_FILES+=("$f")
done < <(bash "${REPO_ROOT}/scripts/ci/shard-flows.sh" --shard "$SHARD_SPEC" --dir "$MAESTRO_DIR")

if [ "${#YAML_FILES[@]}" -eq 0 ]; then
  echo "WARNING: no maestro yaml files for shard $SHARD_SPEC" >&2
  if [ "$SHARD_TOTAL" -eq 1 ]; then
    # 全 shard で 0 件 → e2e gate を skip 扱い
    bash "${SCRIPT_DIR}/create-e2e-marker.sh" --agent "$AGENT_NAME" --base-ref "$BASE_REF"
    exit 0
  fi
  # 多シャードでこの shard だけ 0 件 (例: TOTAL > flow 数) は意味なしだが PASS 扱いで続行
fi

if [ "$SHARD_TOTAL" -eq 1 ]; then
  RESULT_XML="/tmp/maestro-result-${HEAD_SHA:0:8}-${TIMESTAMP}.xml"
else
  RESULT_XML="/tmp/maestro-result-${HEAD_SHA:0:8}-${TIMESTAMP}-shard${SHARD_INDEX}of${SHARD_TOTAL}.xml"
fi

echo "Running maestro tests: shard ${SHARD_SPEC} (${#YAML_FILES[@]} flows)" >&2

# debug-output / screenshot は per-flow に保存して triage を容易にする
DEBUG_DIR="/tmp/maestro-debug-${HEAD_SHA:0:8}-${TIMESTAMP}-shard${SHARD_INDEX}of${SHARD_TOTAL}"
mkdir -p "$DEBUG_DIR"

(cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" maestro test \
  --format junit \
  --output "$RESULT_XML" \
  --debug-output "$DEBUG_DIR" \
  "${YAML_FILES[@]}" 2>&1) || true  # exit code は XML の内容で判定するため無視

if [ ! -f "$RESULT_XML" ]; then
  echo "ERROR: maestro did not produce result XML: $RESULT_XML" >&2
  exit 1
fi

# debug-output の場所を triage script で参照できるよう metadata に書き出す
DEBUG_INDEX="${REPO_ROOT}/.claude/.e2e-debug-shard${SHARD_INDEX}of${SHARD_TOTAL}.json"
mkdir -p "${REPO_ROOT}/.claude"
jq -n \
  --arg result_xml "$RESULT_XML" \
  --arg debug_dir "$DEBUG_DIR" \
  --argjson shard_index "$SHARD_INDEX" \
  --argjson shard_total "$SHARD_TOTAL" \
  '{result_xml: $result_xml, debug_dir: $debug_dir, shard_index: $shard_index, shard_total: $shard_total}' \
  > "$DEBUG_INDEX"

# 単一シャードならそのまま marker 作成
if [ "$SHARD_TOTAL" -eq 1 ]; then
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
