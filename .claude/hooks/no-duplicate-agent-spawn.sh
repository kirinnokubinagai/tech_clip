#!/usr/bin/env bash
# PreToolUse hook (matcher: Agent)
# suffix 付き数字エージェント名（{role}-{N}-2 等）を物理 block する
#
# 目的: coder-1146-2, reviewer-1146-3 などの重複エージェント増殖を防ぐ
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

# {role}-{N} 形式のみチェック（英字始まりで末尾が数字のもの）
# 例: coder-1146 / analyst-1086 / e2e-reviewer-1138
if [[ ! "$AGENT_NAME" =~ ^[a-zA-Z][a-zA-Z0-9-]*-[0-9]+ ]]; then
  exit 0
fi

# suffix 付き数字エージェント名（{role}-{N}-1, -2, -3 等）を block
# パターン: <英字始まりの role>-<issue番号>-<純数字suffix>
# 例: coder-1146-2 → block / coder-flatten-1146 → allow (lane は英字)
if [[ "$AGENT_NAME" =~ ^([a-zA-Z][a-zA-Z0-9-]*-[0-9]+)-([0-9]{1,3})$ ]]; then
  BASE_NAME="${BASH_REMATCH[1]}"
  SUFFIX="${BASH_REMATCH[2]}"
  echo "BLOCKED: suffix 付き数字エージェント名 '$AGENT_NAME' は禁止されています。" >&2
  echo "" >&2
  echo "必須手順（cleanup してから再 spawn）:" >&2
  echo "  1. SendMessage(to: \"$BASE_NAME\", {type: \"shutdown_request\"}) で終了依頼" >&2
  echo "  2. shutdown_response を待つ" >&2
  echo "  3. '$BASE_NAME'（suffix なし）で再 spawn する" >&2
  echo "" >&2
  echo "❌ suffix 付き名称（${BASE_NAME}-${SUFFIX} 等）での spawn は禁止。" >&2
  echo "❌ cleanup せずに再 spawn することも禁止。" >&2
  exit 2
fi

exit 0
