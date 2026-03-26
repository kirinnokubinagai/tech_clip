#!/bin/bash
# 危険なコマンドを検知して確認を促すhook
# $ARGUMENTS 環境変数からBashコマンドを取得

# jqがない場合はスキップ
if ! command -v jq &> /dev/null; then
  exit 0
fi

# $ARGUMENTSからcommandフィールドを抽出
COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# 危険なコマンドパターン
check_dangerous() {
  local cmd="$1"

  # rm コマンド
  echo "$cmd" | grep -qE "^rm " && return 0

  # git 破壊的コマンド
  echo "$cmd" | grep -qE "git reset --hard" && return 0
  echo "$cmd" | grep -qE "git push --force" && return 0
  echo "$cmd" | grep -qE "git push -f " && return 0
  echo "$cmd" | grep -qE "git checkout -- " && return 0
  echo "$cmd" | grep -qE "git clean" && return 0
  echo "$cmd" | grep -qE "git branch -D" && return 0

  # システムコマンド
  echo "$cmd" | grep -qE "^kill " && return 0
  echo "$cmd" | grep -qE "^killall " && return 0
  echo "$cmd" | grep -qE "chmod 777" && return 0
  echo "$cmd" | grep -qE "^sudo " && return 0

  return 1
}

if check_dangerous "$COMMAND"; then
  echo "⚠️ 危険なコマンドを検知しました"
  echo "コマンド: $COMMAND"
  echo ""
  echo "このコマンドは破壊的な操作を行う可能性があります。"
  exit 2  # exit code 2 = ブロック（確認を促す）
fi

exit 0
