#!/bin/bash
# PreToolUse:Edit hook
# 編集前にファイルの最新内容を読んでいるか確認する
# additionalContext で警告を注入（ブロックはしない）
set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

MSG="[診断ファースト] 編集前チェック:
1. このファイルの最新内容をReadで確認したか？古い情報で編集していないか？
2. 問題の根本原因を特定したか？推測で修正していないか？
3. 「安全」「大丈夫」と主張する場合、その根拠は何か？"

if command -v jq &> /dev/null; then
  JSON=$(jq -n --arg msg "$MSG" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$msg}}')
  echo "$JSON"
else
  SAFE_MSG=$(printf '%s' "$MSG" | tr -d '"\\' | tr '\n' ' ')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"${SAFE_MSG}\"}}"
fi

exit 0
