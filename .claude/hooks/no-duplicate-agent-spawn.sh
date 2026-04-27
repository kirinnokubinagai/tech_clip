#!/bin/bash
# PreToolUse hook (matcher: Agent)
# 同名エージェントが既に active-issues チームに存在する場合に spawn をブロックする
#
# 目的: issue-{N}-reviewer-2, -3 などの重複エージェント増殖を防ぐ
# 正しい対応: SendMessage で ping → 30分以上無応答 → AskUserQuestion で人間確認 → 承認後に spawn
#
# 終了コード:
#   0: spawn を許可
#   2: spawn をブロック（Claude Code に理由が表示される）

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
TEAM_CONFIG="$REPO_ROOT/.claude-user/teams/active-issues/config.json"

# チーム config がなければチェック不要
[ -f "$TEAM_CONFIG" ] || exit 0

# jq がなければチェック不要
command -v jq >/dev/null 2>&1 || exit 0

# stdin からツール入力 JSON を読む（Claude Code が渡す）
TOOL_INPUT=$(cat)

# name パラメータを取得
AGENT_NAME=$(echo "$TOOL_INPUT" | jq -r '.name // ""' 2>/dev/null || echo "")

# name が空ならチェック不要
[ -n "$AGENT_NAME" ] || exit 0

# issue-{N}-{role} 形式のみチェック（lane 付き issue-{N}-{role}-{lane} も対象）
if [[ ! "$AGENT_NAME" =~ ^issue-[0-9]+-[a-z] ]]; then
  exit 0
fi

# チーム config から既存メンバー名一覧を取得
EXISTING=$(jq -r '.members[]?.name // empty' "$TEAM_CONFIG" 2>/dev/null || echo "")

while IFS= read -r existing_name; do
  [ -z "$existing_name" ] && continue
  if [ "$existing_name" = "$AGENT_NAME" ]; then
    echo "BLOCKED: エージェント '$AGENT_NAME' は既に active-issues チームに存在します。" >&2
    echo "正しい手順:" >&2
    echo "  1. SendMessage(to: \"$AGENT_NAME\", \"ping: alive?\") で生存確認する" >&2
    echo "  2. 30分以上無応答の場合のみ AskUserQuestion でユーザーに再 spawn の可否を確認する" >&2
    echo "  3. ユーザーの承認を得てから同名で再 spawn する" >&2
    echo "  ※ suffix 付き名称（${AGENT_NAME}-2 等）での spawn も禁止。必ず同名で再 spawn すること" >&2
    exit 2
  fi
done <<< "$EXISTING"

exit 0
