#!/usr/bin/env bash
# check-agent-timeouts.sh
# reviewer 系 agent md のタイムアウト値が config.json の polling_timeout_minutes と一致するか検証する

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${REPO_ROOT}/.claude/config.json"

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: .claude/config.json が見つかりません" >&2
  exit 1
fi

CONFIG_TIMEOUT=$(jq -r '.polling_timeout_minutes' "$CONFIG")

FAILED=0
for f in \
  "${REPO_ROOT}/.claude/agents/reviewer.md" \
  "${REPO_ROOT}/.claude/agents/infra-reviewer.md" \
  "${REPO_ROOT}/.claude/agents/ui-reviewer.md"; do
  if [ ! -f "$f" ]; then
    echo "WARN: $f が見つかりません。スキップします。" >&2
    continue
  fi
  # config_timeout と異なる「N分タイムアウト」表記を検出する
  WRONG=$(grep -oE '[0-9]+分タイムアウト' "$f" | grep -v "^${CONFIG_TIMEOUT}分タイムアウト" || true)
  if [ -n "$WRONG" ]; then
    echo "FAIL: $f に旧タイムアウト表記 (${WRONG}) が残っています。" \
      "config.json の polling_timeout_minutes=${CONFIG_TIMEOUT} に合わせてください。" >&2
    FAILED=1
  fi
done

if [ "$FAILED" -eq 1 ]; then
  exit 1
fi

echo "OK: all reviewer agent timeout values match polling_timeout_minutes=${CONFIG_TIMEOUT}"
