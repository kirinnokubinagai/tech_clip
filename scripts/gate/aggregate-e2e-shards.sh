#!/usr/bin/env bash
# aggregate-e2e-shards.sh: 多シャード E2E 結果を集約して .claude/.e2e-passed marker を生成する
#
# 使い方:
#   bash scripts/gate/aggregate-e2e-shards.sh --agent <name> --shard-total <TOTAL> [--base-ref <ref>]
#
# 動作:
#   .claude/.e2e-shard-{1..TOTAL}of<TOTAL>.json をすべて読む
#   - 全件 PASS かつ全 shard の HEAD SHA が一致 → .e2e-passed (HEAD SHA 1 行) 生成 → exit 0
#   - 1 件でも FAIL or 不在 → marker 生成しない → exit 1
#   - HEAD SHA 不一致（途中で commit が進んだ）→ marker 生成しない → exit 1
#   - shard 結果ファイルは集約後に削除する
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

AGENT_NAME=""
SHARD_TOTAL=""
BASE_REF="origin/main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)       AGENT_NAME="$2";    shift 2 ;;
    --shard-total) SHARD_TOTAL="$2";   shift 2 ;;
    --base-ref)    BASE_REF="$2";       shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT_NAME" ] || [ -z "$SHARD_TOTAL" ]; then
  echo "ERROR: --agent <name> and --shard-total <N> are required" >&2
  exit 1
fi

if ! echo "$SHARD_TOTAL" | grep -qE '^[1-9][0-9]*$'; then
  echo "ERROR: invalid --shard-total: $SHARD_TOTAL" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
MARKER="${REPO_ROOT}/.claude/.e2e-passed"
TMP_MARKER="${MARKER}.tmp.$$"
LOG="${REPO_ROOT}/.claude/last-e2e.log"
CLAUDE_DIR="${REPO_ROOT}/.claude"
COMPLETED_AT=$(date -u +%FT%TZ)

mkdir -p "$CLAUDE_DIR"

TOTAL_FLOWS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_ERRORS=0
FAILURES=()

for i in $(seq 1 "$SHARD_TOTAL"); do
  SHARD_JSON="${CLAUDE_DIR}/.e2e-shard-${i}of${SHARD_TOTAL}.json"
  if [ ! -f "$SHARD_JSON" ]; then
    FAILURES+=("shard ${i}/${SHARD_TOTAL}: 結果ファイル不在 (${SHARD_JSON})")
    continue
  fi

  SHARD_HEAD=$(jq -r '.head_sha // empty' "$SHARD_JSON" 2>/dev/null || echo "")
  if [ "$SHARD_HEAD" != "$HEAD_SHA" ]; then
    FAILURES+=("shard ${i}/${SHARD_TOTAL}: HEAD SHA 不一致 (shard=${SHARD_HEAD:0:12}, current=${HEAD_SHA:0:12})")
    continue
  fi

  STATUS=$(jq -r '.status // "UNKNOWN"' "$SHARD_JSON" 2>/dev/null || echo "UNKNOWN")
  PASSED=$(jq -r '.flows_passed // 0' "$SHARD_JSON" 2>/dev/null || echo 0)
  TOTAL=$(jq -r '.flows_total // 0' "$SHARD_JSON" 2>/dev/null || echo 0)
  FAILED=$(jq -r '.flows_failed // 0' "$SHARD_JSON" 2>/dev/null || echo 0)
  ERRORS=$(jq -r '.flows_errors // 0' "$SHARD_JSON" 2>/dev/null || echo 0)

  TOTAL_FLOWS=$((TOTAL_FLOWS + TOTAL))
  TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))

  if [ "$STATUS" != "PASS" ]; then
    FAILURES+=("shard ${i}/${SHARD_TOTAL}: status=${STATUS} flows=${PASSED}/${TOTAL}")
  fi
done

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo "ERROR: e2e shards aggregation failed:" >&2
  for f in "${FAILURES[@]}"; do
    echo "  - $f" >&2
  done
  if command -v jq &>/dev/null; then
    jq -nc \
      --arg head_sha "$HEAD_SHA" \
      --arg agent "$AGENT_NAME" \
      --arg completed_at "$COMPLETED_AT" \
      --argjson shard_total "$SHARD_TOTAL" \
      --argjson flows_passed "$TOTAL_PASSED" \
      --argjson flows_total "$TOTAL_FLOWS" \
      '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, status: "FAIL", aggregated: true, shard_total: $shard_total, flows_passed: $flows_passed, flows_total: $flows_total}' \
      >> "$LOG" 2>/dev/null || true
  fi
  exit 1
fi

# 全 shard PASS: marker (HEAD SHA 1 行) を atomic write
printf '%s\n' "$HEAD_SHA" > "$TMP_MARKER"
mv "$TMP_MARKER" "$MARKER"
echo "e2e marker created: $MARKER (sha=$HEAD_SHA shards=$SHARD_TOTAL flows=$TOTAL_PASSED/$TOTAL_FLOWS)" >&2

# shard 結果ファイルを cleanup
for i in $(seq 1 "$SHARD_TOTAL"); do
  rm -f "${CLAUDE_DIR}/.e2e-shard-${i}of${SHARD_TOTAL}.json"
done

# 詳細ログを JSON Lines で append
if command -v jq &>/dev/null; then
  jq -nc \
    --arg head_sha "$HEAD_SHA" \
    --arg agent "$AGENT_NAME" \
    --arg completed_at "$COMPLETED_AT" \
    --argjson shard_total "$SHARD_TOTAL" \
    --argjson flows_passed "$TOTAL_PASSED" \
    --argjson flows_total "$TOTAL_FLOWS" \
    '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, status: "PASS", aggregated: true, shard_total: $shard_total, flows_passed: $flows_passed, flows_total: $flows_total}' \
    >> "$LOG"
fi
