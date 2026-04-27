#!/usr/bin/env bash
# create-e2e-marker.sh: E2E gate 判定結果に基づき .claude/.e2e-passed を書き込む
#
# 使い方:
#   bash scripts/gate/create-e2e-marker.sh --agent <name> [--maestro-result <xml>] [--base-ref <ref>]
#
# 動作:
#   E2E 不要 (no_e2e_affecting_paths)         → marker 作成しない, exit 0 (skip)
#   E2E 必要 && auto_skip                     → marker 作成しない, exit 0 (skip)
#   E2E 必要 && !auto_skip && --maestro-result なし → exit 1
#   E2E 必要 && !auto_skip && PASS            → marker (HEAD SHA 1 行) atomic write, exit 0
#   E2E 必要 && !auto_skip && FAIL            → marker 作成しない, exit 1
#
# 詳細ログは .claude/last-e2e.log に JSON Lines で append される
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
LOG="${REPO_ROOT}/.claude/last-e2e.log"
CLAUDE_DIR="${REPO_ROOT}/.claude"
COMPLETED_AT=$(date -u +%FT%TZ)

_log_jsonl() {
  if command -v jq &>/dev/null; then
    jq -nc "$@" >> "$LOG" 2>/dev/null || true
  fi
}

# evaluate-paths.sh で e2e_gate 判定
EVAL_JSON=$(bash "${SCRIPT_DIR}/evaluate-paths.sh" "$BASE_REF" 2>/dev/null)
E2E_REQUIRED=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.required')
E2E_AUTO_SKIP=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.auto_skip')
E2E_SKIP_REASON=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.skip_reason')

# E2E 不要 → marker 作成しない (pre-push hook が evaluate-paths.sh で再判定する)
if [ "$E2E_REQUIRED" = "false" ]; then
  echo "e2e gate: not required (no_e2e_affecting_paths) — marker not created" >&2
  mkdir -p "$CLAUDE_DIR"
  _log_jsonl \
    --arg head_sha "$HEAD_SHA" \
    --arg agent "$AGENT_NAME" \
    --arg completed_at "$COMPLETED_AT" \
    '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, skipped: true, skip_reason: "no_e2e_affecting_paths"}'
  exit 0
fi

# E2E 必要 && auto_skip → marker 作成しない (pre-push hook が再判定で通過する)
if [ "$E2E_AUTO_SKIP" = "true" ]; then
  echo "e2e gate: auto_skip ($E2E_SKIP_REASON) — marker not created" >&2
  mkdir -p "$CLAUDE_DIR"
  _log_jsonl \
    --arg head_sha "$HEAD_SHA" \
    --arg agent "$AGENT_NAME" \
    --arg completed_at "$COMPLETED_AT" \
    --arg skip_reason "$E2E_SKIP_REASON" \
    '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, skipped: true, skip_reason: $skip_reason}'
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
  mkdir -p "$CLAUDE_DIR"
  _log_jsonl \
    --arg head_sha "$HEAD_SHA" \
    --arg agent "$AGENT_NAME" \
    --arg completed_at "$COMPLETED_AT" \
    --argjson flows_passed "$FLOWS_PASSED" \
    --argjson flows_total "$FLOWS_TOTAL" \
    --argjson flows_failed "$FLOWS_FAILED" \
    --argjson flows_errors "$FLOWS_ERRORS" \
    '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, status: "FAIL", flows_passed: $flows_passed, flows_total: $flows_total, flows_failed: $flows_failed, flows_errors: $flows_errors}'
  exit 1
fi

# 全 flow PASS: marker (HEAD SHA 1 行) を atomic write
mkdir -p "$CLAUDE_DIR"
printf '%s\n' "$HEAD_SHA" > "$TMP_MARKER"
mv "$TMP_MARKER" "$MARKER"
echo "e2e marker created: $MARKER (sha=$HEAD_SHA flows=$FLOWS_PASSED/$FLOWS_TOTAL)" >&2

_log_jsonl \
  --arg head_sha "$HEAD_SHA" \
  --arg agent "$AGENT_NAME" \
  --arg completed_at "$COMPLETED_AT" \
  --arg log_path "$MAESTRO_RESULT" \
  --argjson flows_passed "$FLOWS_PASSED" \
  --argjson flows_total "$FLOWS_TOTAL" \
  '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, status: "PASS", log_path: $log_path, flows_passed: $flows_passed, flows_total: $flows_total}'
