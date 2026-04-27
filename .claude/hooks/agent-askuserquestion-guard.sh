#!/usr/bin/env bash
# PreToolUse:AskUserQuestion hook
# AskUserQuestion は orchestrator (team-lead) 専属。
# サブエージェント (issue-{N}-{role}) からの呼び出しを物理 block する。

set -euo pipefail

INPUT=$(cat)
AGENT_NAME="${CLAUDE_AGENT_NAME:-}"

# orchestrator (= サブエージェントとして spawn されていない = CLAUDE_AGENT_NAME が unset または空) は許可
if [ -z "$AGENT_NAME" ]; then
  exit 0
fi

# サブエージェント名は必ず issue-{N}-{role} 形式
if echo "$AGENT_NAME" | grep -qE '^issue-[0-9]+-'; then
  echo "DENY: AskUserQuestion は orchestrator (team-lead) 専属です。" >&2
  echo "  サブエージェント '$AGENT_NAME' は SendMessage で orchestrator に bubble up してください。" >&2
  echo "  形式: SendMessage(to: \"team-lead\", message: \"QUESTION_FOR_USER: <内容>\")" >&2
  printf '{"decision":"block","reason":"AskUserQuestion is orchestrator-only. Use SendMessage to bubble up to team-lead."}'
  exit 2
fi

exit 0
