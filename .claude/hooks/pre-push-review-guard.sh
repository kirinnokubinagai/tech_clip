#!/bin/bash
# PreToolUse:Bash hook: git push前にローカルレビュー完了を強制

if ! command -v jq &> /dev/null; then
  exit 0
fi

COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -q "git push"; then
  exit 0
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$ROOT" ]; then
  exit 0
fi

MARKER="${ROOT}/.claude/.review-passed"

if [ ! -f "$MARKER" ]; then
  echo "DENY: ローカルレビューが完了していません。pushできません。" >&2
  echo "  code-reviewerエージェントでレビューを実行し、全件PASSしてからpushしてください。" >&2
  echo "  レビュー完了後、マーカーファイルが自動作成されます: ${MARKER}" >&2
  exit 2
fi

exit 0
