#!/usr/bin/env bash
# PreToolUse hook: orchestrator のフロー逸脱を物理ブロック
#
# 検知・ブロック対象:
#   1. analyst なしで coder/reviewer を spawn (Agent tool)
#   2. AskUserQuestion なしで gh issue close (Bash tool)
#   3. reviewer 以外が gh pr merge (Bash tool)
#   4. force push (Bash tool)

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}')

TEAM_CONFIG="${HOME}/.claude-user/teams/active-issues/config.json"

deny() {
  local msg="$1"
  echo "$msg" >&2
  printf '{"decision":"block","reason":"%s"}' "$msg"
  exit 2
}

# Agent tool intercept: analyst 省略検知
if [ "$TOOL_NAME" = "Agent" ]; then
  NAME=$(echo "$TOOL_INPUT" | jq -r '.name // ""')
  case "$NAME" in
    issue-[0-9]*-coder|issue-[0-9]*-infra-engineer|issue-[0-9]*-ui-designer|\
issue-[0-9]*-reviewer|issue-[0-9]*-infra-reviewer|issue-[0-9]*-ui-reviewer)
      ISSUE_NUM=$(echo "$NAME" | grep -oE '^issue-[0-9]+' | grep -oE '[0-9]+')
      ANALYST_NAME="issue-${ISSUE_NUM}-analyst"
      if [ -f "$TEAM_CONFIG" ]; then
        EXISTS=$(jq -r --arg n "$ANALYST_NAME" \
          '[.members[] | select(.name == $n)] | length' "$TEAM_CONFIG" 2>/dev/null || echo "0")
        if [ "$EXISTS" = "0" ]; then
          deny "DENY: Issue #${ISSUE_NUM} に analyst (${ANALYST_NAME}) が存在しません。CLAUDE.md 必須 spawn 順序に従い analyst を先に spawn してください。"
        fi
      fi
      ;;
  esac
fi

# Bash tool intercept: 独断 close/merge/push
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // ""')

  # gh issue close は AskUserQuestion 事前確認が必要
  if echo "$COMMAND" | grep -qE '^\s*gh\s+issue\s+close\s'; then
    if ! ls "${HOME}"/.claude-user/projects/*/memory/tmp-last-askuserquestion.flag 2>/dev/null | head -1 | grep -q .; then
      deny "DENY: 'gh issue close' は AskUserQuestion で事前確認してから実行してください。CLAUDE.md 絶対ルール (ワークフロー逸脱)。"
    fi
  fi

  # gh pr merge は reviewer 系 agent のみ許可
  if echo "$COMMAND" | grep -qE '^\s*gh\s+pr\s+merge\s'; then
    if [ -z "${CLAUDE_AGENT_NAME:-}" ] || \
       ! echo "${CLAUDE_AGENT_NAME}" | grep -qE '(reviewer|infra-reviewer|ui-reviewer)'; then
      deny "DENY: 'gh pr merge' は reviewer 系 agent のみ実行可能です (CLAUDE_AGENT_NAME=${CLAUDE_AGENT_NAME:-unset})。"
    fi
  fi

  # force push は禁止
  if echo "$COMMAND" | grep -qE 'git\s+push\s+.*(-f[[:space:]]|--force[[:space:]]|-f$|--force$)'; then
    deny "DENY: force push は禁止されています。CLAUDE.md 絶対ルール参照。"
  fi
fi

exit 0
