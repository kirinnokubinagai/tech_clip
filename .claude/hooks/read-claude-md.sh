#!/usr/bin/env bash
# SessionStart hook: AGENTS / CLAUDE と .claude/rules を additionalContext として再注入する

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
AGENTS_MD="${REPO_ROOT}/AGENTS.md"
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"
RULES_DIR="${REPO_ROOT}/.claude/rules"

if [[ ! -f "${AGENTS_MD}" && ! -f "${CLAUDE_MD}" ]]; then
  exit 0
fi

MESSAGE=$'⚠️ CRITICAL WORKFLOW REMINDER ⚠️\n必ずこのフローを守ること（違反は全フックでブロックされる）:\n  コード変更依頼 → Issue確認/作成 → Worktree作成 → TeamCreate → エージェント起動\n  直接ファイル編集禁止 / Agent(coder) 直接呼び出し禁止\n\n'

if [[ -f "${AGENTS_MD}" ]]; then
  AGENTS_CONTENT=$(cat "${AGENTS_MD}")
  MESSAGE+=$'=== AGENTS.md 再確認 ===\n'"${AGENTS_CONTENT}"$'\n\n'
elif [[ -f "${CLAUDE_MD}" ]]; then
  CLAUDE_CONTENT=$(cat "${CLAUDE_MD}")
  MESSAGE+=$'=== CLAUDE.md 再確認 ===\n'"${CLAUDE_CONTENT}"$'\n\n'
fi

if [[ -d "${RULES_DIR}" ]]; then
  while IFS= read -r rule_file; do
    rule_name=$(basename "${rule_file}")
    rule_content=$(cat "${rule_file}")
    MESSAGE+=$'=== .claude/rules/'"${rule_name}"$' ===\n'"${rule_content}"$'\n\n'
  done < <(find "${RULES_DIR}" -maxdepth 1 -type f -name "*.md" | sort)
fi

if command -v jq >/dev/null 2>&1; then
  jq -n --arg msg "${MESSAGE}" \
    '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}'
  exit 0
fi

SANITIZED_MESSAGE=$(printf '%s' "${MESSAGE}" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "${SANITIZED_MESSAGE}"
