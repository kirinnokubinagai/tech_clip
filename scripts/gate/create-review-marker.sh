#!/usr/bin/env bash
# create-review-marker.sh: lint/typecheck/test を実行し PASS 時に .claude/.review-passed を書き込む
#
# 使い方: bash scripts/gate/create-review-marker.sh --agent <agent-name>
#
# 成功: .claude/.review-passed に JSON を atomic write して exit 0
# 失敗: exit 1, マーカーなし, stderr に詳細
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

AGENT_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT_NAME="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT_NAME" ]; then
  echo "ERROR: --agent <name> is required" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
MARKER="${REPO_ROOT}/.claude/.review-passed"
TMP_MARKER="${MARKER}.tmp.$$"
CLAUDE_DIR="${REPO_ROOT}/.claude"

# lint
echo "--- lint ---" >&2
LINT_STATUS="FAIL"
if (cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" pnpm lint 2>&1); then
  LINT_STATUS="PASS"
else
  echo "ERROR: lint failed" >&2
  exit 1
fi

# typecheck
echo "--- typecheck ---" >&2
TYPECHECK_STATUS="FAIL"
if (cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" pnpm typecheck 2>&1); then
  TYPECHECK_STATUS="PASS"
else
  echo "ERROR: typecheck failed" >&2
  exit 1
fi

# test (api + mobile 並列)
echo "--- test ---" >&2
API_TMP=$(mktemp)
MOBILE_TMP=$(mktemp)
API_EXIT=0
MOBILE_EXIT=0

(cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" pnpm --filter @tech-clip/api test --reporter=verbose 2>&1) > "$API_TMP" &
API_PID=$!
(cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" pnpm --filter @tech-clip/mobile test --reporter=verbose 2>&1) > "$MOBILE_TMP" &
MOBILE_PID=$!

wait "$API_PID" || API_EXIT=$?
wait "$MOBILE_PID" || MOBILE_EXIT=$?

cat "$API_TMP" >&2
cat "$MOBILE_TMP" >&2

# テスト件数を取得 (vitest 出力から "N passed" を抽出)
API_PASSED=$(grep -oE '[0-9]+ passed' "$API_TMP" | tail -1 | grep -oE '[0-9]+' || echo 0)
API_TOTAL=$(grep -oE '[0-9]+ tests' "$API_TMP" | tail -1 | grep -oE '[0-9]+' || echo "$API_PASSED")
MOBILE_PASSED=$(grep -oE '[0-9]+ passed' "$MOBILE_TMP" | tail -1 | grep -oE '[0-9]+' || echo 0)
MOBILE_TOTAL=$(grep -oE '[0-9]+ tests' "$MOBILE_TMP" | tail -1 | grep -oE '[0-9]+' || echo "$MOBILE_PASSED")

rm -f "$API_TMP" "$MOBILE_TMP"

if [ "$API_EXIT" -ne 0 ] || [ "$MOBILE_EXIT" -ne 0 ]; then
  echo "ERROR: tests failed (api_exit=$API_EXIT mobile_exit=$MOBILE_EXIT)" >&2
  exit 1
fi

TEST_STATUS="PASS"
COMPLETED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)

# atomic write
mkdir -p "$CLAUDE_DIR"
jq -n \
  --arg schema_version "1" \
  --arg head_sha "$HEAD_SHA" \
  --arg agent "$AGENT_NAME" \
  --arg completed_at "$COMPLETED_AT" \
  --arg lint_status "$LINT_STATUS" \
  --arg typecheck_status "$TYPECHECK_STATUS" \
  --arg test_status "$TEST_STATUS" \
  --argjson api_passed "$API_PASSED" \
  --argjson api_total "$API_TOTAL" \
  --argjson mobile_passed "$MOBILE_PASSED" \
  --argjson mobile_total "$MOBILE_TOTAL" \
  '{
    schema_version: 1,
    head_sha: $head_sha,
    agent: $agent,
    completed_at: $completed_at,
    lint_status: $lint_status,
    typecheck_status: $typecheck_status,
    tests: {
      api: {passed: $api_passed, total: $api_total},
      mobile: {passed: $mobile_passed, total: $mobile_total}
    }
  }' > "$TMP_MARKER"

mv "$TMP_MARKER" "$MARKER"
echo "review marker created: $MARKER (sha=$HEAD_SHA)" >&2
