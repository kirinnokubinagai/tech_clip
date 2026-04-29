#!/usr/bin/env bash
# PreToolUse hook (matcher: Agent)
# suffix 付き数字エージェント名（issue-{N}-{role}-2 等）を物理 block する
#
# 目的: issue-{N}-reviewer-2, -3 などの重複エージェント増殖を防ぐ
#
# 同名衝突（既に同名エージェントが存在する場合）の検出はこのフック単体では
# 実現できない（in-process エージェントは ps に表示されないため）。
# 同名衝突の防止は harness-spawn-flow skill 側で cleanup → spawn の
# 順序を保証することで担保する。
#
# 終了コード:
#   0: spawn を許可
#   2: spawn をブロック（Claude Code に理由が表示される）

set -euo pipefail

# stdin からツール入力 JSON を読む（Claude Code が渡す）
TOOL_INPUT=$(cat)

# jq がなければチェック不要
command -v jq >/dev/null 2>&1 || exit 0

# name パラメータを取得（.tool_input.name が正しいパス）
AGENT_NAME=$(echo "$TOOL_INPUT" | jq -r '.tool_input.name // ""' 2>/dev/null || echo "")

# name が空ならチェック不要
[ -n "$AGENT_NAME" ] || exit 0

# issue-{N}-{role} 形式のみチェック（lane 付き issue-{N}-{role}-{lane} も対象）
if [[ ! "$AGENT_NAME" =~ ^issue-[0-9]+-[a-z] ]]; then
  exit 0
fi

# suffix 付き数字エージェント名（issue-{N}-{role}-1, -2, -3 等）を block
# 末尾が純粋な数字 1-3 桁の場合のみ block（lane 名は英字始まりのため区別可能）
# 例: issue-1056-coder-2 → block / issue-1056-coder-api → allow
if [[ "$AGENT_NAME" =~ ^issue-[0-9]+-[a-z][a-zA-Z0-9-]*-([0-9]{1,3})$ ]]; then
  SUFFIX="${BASH_REMATCH[1]}"
  BASE_NAME="${AGENT_NAME%-${SUFFIX}}"
  echo "BLOCKED: suffix 付き数字エージェント名 '$AGENT_NAME' は禁止されています。" >&2
  echo "" >&2
  echo "必須手順（cleanup してから再 spawn）:" >&2
  echo "  1. SendMessage(to: \"$BASE_NAME\", {type: \"shutdown_request\"}) で終了依頼" >&2
  echo "  2. shutdown_response を待つ" >&2
  echo "  3. '$BASE_NAME'（suffix なし）で再 spawn する" >&2
  echo "" >&2
  echo "❌ suffix 付き名称（${BASE_NAME}-2 等）での spawn は禁止。" >&2
  echo "❌ cleanup せずに再 spawn することも禁止。" >&2
  exit 2
fi

exit 0
