#!/usr/bin/env bash
# SessionStart hook: open issues を全件取得し orchestrator に渡す
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
SCRIPT="${REPO_ROOT}/scripts/next-issue-candidates.sh"

if [ ! -x "$SCRIPT" ]; then
  exit 0
fi

CANDIDATES=$(bash "$SCRIPT" --json 2>/dev/null) || exit 0

AUTO_COUNT=$(echo "$CANDIDATES" | jq '.auto_assignable | length' 2>/dev/null || echo 0)
HUMAN_COUNT=$(echo "$CANDIDATES" | jq '.requires_human | length' 2>/dev/null || echo 0)

if [ "$AUTO_COUNT" -eq 0 ] && [ "$HUMAN_COUNT" -eq 0 ]; then
  exit 0
fi

AUTO_LIST=""
if [ "$AUTO_COUNT" -gt 0 ]; then
  AUTO_LIST=$(echo "$CANDIDATES" | jq -r '.auto_assignable[] | "  - #\(.number): \(.title)"' 2>/dev/null)
fi

HUMAN_LIST=""
if [ "$HUMAN_COUNT" -gt 0 ]; then
  HUMAN_LIST=$(echo "$CANDIDATES" | jq -r '.requires_human[] | "  - #\(.number): \(.title)"' 2>/dev/null)
fi

CONTEXT="⚡ 自動 Issue triage 結果:
auto_assignable (${AUTO_COUNT} 件):
${AUTO_LIST}
"

if [ "$HUMAN_COUNT" -gt 0 ]; then
  CONTEXT="${CONTEXT}
requires_human (${HUMAN_COUNT} 件) — ユーザーに一覧提示のみ:
${HUMAN_LIST}
"
fi

CONTEXT="${CONTEXT}
指示: auto_assignable の Issue を harness-spawn-flow skill で spawn 開始すること。同時処理数は orchestrator が判断する。ユーザーの指示を待たず自律的に着手せよ。"

jq -n --arg ctx "$CONTEXT" '{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $ctx
  }
}'
