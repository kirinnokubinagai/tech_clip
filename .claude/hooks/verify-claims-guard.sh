#!/bin/bash
# Stop hook
# 完了報告前に主張の検証を促す
set -euo pipefail

MSG="[完了前チェック] 以下を確認してから完了報告すること:
1. 主張に証拠はあるか？（テスト結果、コマンド出力、ファイル内容）
2. 検証なしに「安全」「問題ない」と言っていないか？
3. 根本原因を特定したか？表面的なパッチではないか？
4. 最新のソースコードを確認したか？古い情報に基づいていないか？"

if command -v jq &> /dev/null; then
  JSON=$(jq -n --arg msg "$MSG" '{hookSpecificOutput:{hookEventName:"Stop",additionalContext:$msg}}')
  echo "$JSON"
else
  SAFE_MSG=$(printf '%s' "$MSG" | tr -d '"\\' | tr '\n' ' ')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"Stop\",\"additionalContext\":\"${SAFE_MSG}\"}}"
fi

exit 0
