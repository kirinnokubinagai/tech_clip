#!/bin/bash
# PreToolUse:Bash hook
# git push 前にローカルレビュー完了を強制する
# .claude/.review-passed マーカーファイルが存在しなければ DENY

# jqがない場合はスキップ
if ! command -v jq &> /dev/null; then
  exit 0
fi

# $ARGUMENTSからcommandフィールドを抽出
COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# git push コマンドでなければスキップ
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

# push成功後にマーカーを削除（次回も必ずレビューが必要）
rm -f "$MARKER"

exit 0
