#!/usr/bin/env bash
# create-e2e-marker.sh: E2E gate 判定結果に基づき .claude/.e2e-passed を書き込む
#
# 使い方:
#   bash scripts/gate/create-e2e-marker.sh --agent <name> [--maestro-result <xml>] [--base-ref <ref>]
#
# E2E 不要: skip marker 書き込み → exit 0
# E2E 必要 && auto_skip: skip marker 書き込み → exit 0
# E2E 必要 && !auto_skip && --maestro-result なし: exit 1
# E2E 必要 && !auto_skip && --maestro-result あり: XML parse → PASS なら marker → exit 0 / FAIL なら exit 1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

AGENT_NAME=""
MAESTRO_RESULT=""
BASE_REF="origin/main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)          AGENT_NAME="$2";       shift 2 ;;
    --maestro-result) MAESTRO_RESULT="$2";   shift 2 ;;
    --base-ref)       BASE_REF="$2";          shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT_NAME" ]; then
  echo "ERROR: --agent <name> is required" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
MARKER="${REPO_ROOT}/.claude/.e2e-passed"
TMP_MARKER="${MARKER}.tmp.$$"
CLAUDE_DIR="${REPO_ROOT}/.claude"
COMPLETED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)

# evaluate-paths.sh で e2e_gate 判定
EVAL_JSON=$(bash "${SCRIPT_DIR}/evaluate-paths.sh" "$BASE_REF" 2>/dev/null)
E2E_REQUIRED=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.required')
E2E_AUTO_SKIP=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.auto_skip')
E2E_SKIP_REASON=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.skip_reason')
E2E_SKIP_PATHS=$(echo "$EVAL_JSON" | jq -c '.e2e_gate.skip_paths_matched')

_write_skip_marker() {
  local reason="$1"
  local skip_paths="${2:-[]}"
  mkdir -p "$CLAUDE_DIR"
  jq -n \
    --arg head_sha "$HEAD_SHA" \
    --arg agent "$AGENT_NAME" \
    --arg completed_at "$COMPLETED_AT" \
    --arg skip_reason "$reason" \
    --argjson skip_paths "$skip_paths" \
    '{
      schema_version: 1,
      head_sha: $head_sha,
      agent: $agent,
      completed_at: $completed_at,
      skipped: true,
      skip_reason: $skip_reason,
      skip_paths_matched: $skip_paths
    }' > "$TMP_MARKER"
  mv "$TMP_MARKER" "$MARKER"
  echo "e2e marker (skip) created: $MARKER reason=$reason" >&2
}

# E2E 不要
if [ "$E2E_REQUIRED" = "false" ]; then
  _write_skip_marker "no_e2e_affecting_paths" "[]"
  exit 0
fi

# E2E 必要 && auto_skip
if [ "$E2E_AUTO_SKIP" = "true" ]; then
  _write_skip_marker "$E2E_SKIP_REASON" "$E2E_SKIP_PATHS"
  exit 0
fi

# E2E 必要 && !auto_skip → maestro 結果が必要
if [ -z "$MAESTRO_RESULT" ]; then
  echo "ERROR: E2E gate requires maestro test execution." >&2
  echo "  Run: bash scripts/gate/run-maestro-and-create-marker.sh --agent $AGENT_NAME" >&2
  exit 1
fi

if [ ! -f "$MAESTRO_RESULT" ]; then
  echo "ERROR: maestro result file not found: $MAESTRO_RESULT" >&2
  exit 1
fi

# JUnit XML parse: testsuite/@tests と @failures/@errors
FLOWS_TOTAL=$(grep -oE 'tests="[0-9]+"' "$MAESTRO_RESULT" | head -1 | grep -oE '[0-9]+' || echo 0)
FLOWS_FAILED=$(grep -oE 'failures="[0-9]+"' "$MAESTRO_RESULT" | head -1 | grep -oE '[0-9]+' || echo 0)
FLOWS_ERRORS=$(grep -oE 'errors="[0-9]+"' "$MAESTRO_RESULT" | head -1 | grep -oE '[0-9]+' || echo 0)
FLOWS_PASSED=$((FLOWS_TOTAL - FLOWS_FAILED - FLOWS_ERRORS))

if [ "$FLOWS_FAILED" -ne 0 ] || [ "$FLOWS_ERRORS" -ne 0 ]; then
  echo "ERROR: Maestro tests failed (passed=$FLOWS_PASSED total=$FLOWS_TOTAL failures=$FLOWS_FAILED errors=$FLOWS_ERRORS)" >&2
  exit 1
fi

RUN_ID="${HEAD_SHA:0:8}-$(date +%s)"

mkdir -p "$CLAUDE_DIR"
jq -n \
  --arg head_sha "$HEAD_SHA" \
  --arg agent "$AGENT_NAME" \
  --arg completed_at "$COMPLETED_AT" \
  --arg run_id "$RUN_ID" \
  --arg log_path "$MAESTRO_RESULT" \
  --argjson flows_passed "$FLOWS_PASSED" \
  --argjson flows_total "$FLOWS_TOTAL" \
  '{
    schema_version: 1,
    head_sha: $head_sha,
    agent: $agent,
    completed_at: $completed_at,
    skipped: false,
    run_id: $run_id,
    log_path: $log_path,
    flows_passed: $flows_passed,
    flows_total: $flows_total
  }' > "$TMP_MARKER"

mv "$TMP_MARKER" "$MARKER"
echo "e2e marker created: $MARKER (sha=$HEAD_SHA flows=$FLOWS_PASSED/$FLOWS_TOTAL)" >&2
