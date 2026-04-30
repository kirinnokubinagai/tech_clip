#!/usr/bin/env bash
# PreToolUse:AskUserQuestion hook
# AskUserQuestion は orchestrator (team-lead) 専属。
# サブエージェント ({role}-{N}) からの呼び出しを物理 block する。

set -euo pipefail

INPUT=$(cat)
AGENT_NAME="${CLAUDE_AGENT_NAME:-}"

# orchestrator (= サブエージェントとして spawn されていない = CLAUDE_AGENT_NAME が unset または空) は許可
if [ -z "$AGENT_NAME" ]; then
  exit 0
fi

# サブエージェント名は必ず {role}-{N} 形式（N は Issue 番号）
if echo "$AGENT_NAME" | grep -qE '^(analyst|coder|infra-engineer|ui-designer|reviewer|infra-reviewer|ui-reviewer|e2e-reviewer)(-[a-zA-Z0-9-]+)?-[0-9]+$'; then
  echo "DENY: AskUserQuestion は orchestrator (team-lead) 専属です。" >&2
  echo "  サブエージェント '$AGENT_NAME' は SendMessage で orchestrator に bubble up してください。" >&2
  echo "  形式: SendMessage(to: \"team-lead\", message: \"QUESTION_FOR_USER: <内容>\")" >&2
  printf '{"decision":"block","reason":"AskUserQuestion is orchestrator-only. Use SendMessage to bubble up to team-lead."}'
  exit 2
fi

exit 0
