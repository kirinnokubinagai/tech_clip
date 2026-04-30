#!/usr/bin/env bash
# agent-name.sh: エージェント名のパース・構築ヘルパー
#
# 使用方法:
#   source scripts/lib/agent-name.sh
#   parse_agent_name "coder-api-1056"  → AGENT_ROLE=coder, AGENT_LANE=api, AGENT_ISSUE=1056
#   build_agent_name "coder" "1056" "api"  → "coder-api-1056"
#
# 新形式: {role}-{N} / {role}-{lane}-{N}  (N = Issue 番号)

parse_agent_name() {
  local name="$1"
  if [[ "$name" =~ ^(analyst|e2e-reviewer|coder|infra-engineer|ui-designer|reviewer|infra-reviewer|ui-reviewer)(-([a-zA-Z0-9-]+))?-([0-9]+)$ ]]; then
    AGENT_ROLE="${BASH_REMATCH[1]}"
    AGENT_LANE="${BASH_REMATCH[3]}"
    AGENT_ISSUE="${BASH_REMATCH[4]}"
    return 0
  fi
  return 1
}

build_agent_name() {
  local role="$1" issue="$2" lane="${3:-}"
  if [ -n "$lane" ]; then
    echo "${role}-${lane}-${issue}"
  else
    echo "${role}-${issue}"
  fi
}
