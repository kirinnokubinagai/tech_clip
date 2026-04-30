#!/usr/bin/env bash
# PreToolUse hook: orchestrator のフロー逸脱を物理ブロック
# ブロック対象:
#   1. analyst なし implementation/reviewer の Agent spawn
#   2. reviewer 系の重複 spawn (-2/-3 サフィックス)
#   3. AskUserQuestion 未承認の gh issue close / git push --no-verify
#   4. reviewer 系以外の gh pr merge / git push (push-verified.sh 経由を除く)
#   5. force push
#   6. mockup 未承認の ui-designer impl-ready 送信
#   7. orchestrator が spec を実装エージェントへ直接送信

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CLAUDE_USER_ROOT="${CLAUDE_USER_ROOT:-${REPO_ROOT}/.claude-user}"
TEAM_CONFIG="${CLAUDE_USER_ROOT}/teams/active-issues/config.json"

# shellcheck source=../../scripts/lib/askuserquestion-flag.sh
source "${REPO_ROOT}/scripts/lib/askuserquestion-flag.sh"

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}')

# Walk the process tree to find the invoking claude binary and extract --agent-name.
# The SDK passes --agent-name <name> when spawning sub-agents but not for the orchestrator.
# CLAUDE_AGENT_NAME env var is NOT injected by the SDK; this is the only reliable source.
_detect_claude_agent_name() {
  local current_pid=$$
  local parent_pid parent_comm parent_args
  for _ in $(seq 1 20); do
    parent_pid=$(ps -p "$current_pid" -o ppid= 2>/dev/null | tr -d " ")
    [ -z "$parent_pid" ] || [ "$parent_pid" = "0" ] || [ "$parent_pid" = "1" ] && break
    parent_comm=$(ps -p "$parent_pid" -o comm= 2>/dev/null || echo "")
    if echo "$parent_comm" | grep -qE "^claude$"; then
      parent_args=$(ps -p "$parent_pid" -o args= 2>/dev/null || echo "")
      echo "$parent_args" | grep -oE -- '--agent-name[= ][^ ]+' | sed 's/^--agent-name[= ]//' | head -1
      return 0
    fi
    current_pid=$parent_pid
  done
  echo ""
}

# Prefer env var (explicit override / test injection) then fall back to process tree.
# Tests can also set _CLAUDE_DETECTED_AGENT_NAME to bypass ps-based detection.
DETECTED_AGENT_NAME="${CLAUDE_AGENT_NAME:-${_CLAUDE_DETECTED_AGENT_NAME:-$(_detect_claude_agent_name)}}"

deny() {
  local msg="$1"
  echo "$msg" >&2
  printf '{"decision":"block","reason":"%s"}' "$msg"
  exit 2
}

# ─── Agent: analyst 省略 / reviewer 重複 ───
if [ "$TOOL_NAME" = "Agent" ]; then
  NAME=$(echo "$TOOL_INPUT" | jq -r '.name // ""')
  case "$NAME" in
    coder-*|infra-engineer-*|ui-designer-*|reviewer-*|infra-reviewer-*|ui-reviewer-*)
      if [[ "$NAME" =~ -([0-9]+)$ ]]; then
        ISSUE_NUM="${BASH_REMATCH[1]}"
      else
        exit 0
      fi
      [ -f "$TEAM_CONFIG" ] || deny "DENY: active-issues team が未作成。TeamCreate(\"active-issues\") を先に実行。"

      ANALYST="analyst-${ISSUE_NUM}"
      EXISTS=$(jq -r --arg n "$ANALYST" '[.members[]|select(.name==$n)]|length' "$TEAM_CONFIG" 2>/dev/null || echo 0)
      [ "$EXISTS" = "0" ] && deny "DENY: Issue #${ISSUE_NUM} に analyst (${ANALYST}) が未存在。harness-spawn-flow に従い 4 体セット同時 spawn してください。"

      # 同名既存 block（旧 no-duplicate-agent-spawn フックの代替）
      EXISTS_SELF=$(jq -r --arg n "$NAME" '[.members[]|select(.name==$n)]|length' "$TEAM_CONFIG" 2>/dev/null || echo 0)
      [ "$EXISTS_SELF" != "0" ] && deny "DENY: agent '$NAME' は既に team config に存在。harness-agent-cleanup → cleanup → 再 spawn してください。"
      ;;
  esac
fi

# ─── Bash: gh / git 制限 ───
if [ "$TOOL_NAME" = "Bash" ]; then
  CMD=$(echo "$TOOL_INPUT" | jq -r '.command // ""')

  # gh issue close: AskUserQuestion 5 分以内
  if echo "$CMD" | grep -qE '^\s*gh\s+issue\s+close\s'; then
    check_askuserquestion_flag 300 || deny "DENY: 'gh issue close' は AskUserQuestion で事前確認 (5 分以内) してから実行してください。"
  fi

  # gh pr merge: reviewer 系のみ
  if echo "$CMD" | grep -qE '^\s*gh\s+pr\s+merge\s'; then
    echo "${DETECTED_AGENT_NAME}" | grep -qE '(reviewer|infra-reviewer|ui-reviewer)' \
      || deny "DENY: 'gh pr merge' は reviewer 系のみ実行可 (agent=${DETECTED_AGENT_NAME:-unset})。"
  fi

  # force push: 完全禁止
  if echo "$CMD" | grep -qE 'git\s+push\s+.*(-f[[:space:]]|--force[[:space:]]|-f$|--force$)'; then
    deny "DENY: force push 禁止。"
  fi

  # git push --no-verify: AskUserQuestion 5 分以内
  if echo "$CMD" | grep -qE '^\s*git\s+push\s+.*--no-verify'; then
    check_askuserquestion_flag 300 || deny "DENY: 'git push --no-verify' は AskUserQuestion で事前確認 (5 分以内) してから実行してください。"
  fi

  # git push: reviewer 系 or push-verified.sh 経由のみ
  if echo "$CMD" | grep -qE '^\s*git\s+push\s' && ! echo "$CMD" | grep -q 'push-verified\.sh'; then
    echo "${DETECTED_AGENT_NAME}" | grep -qE '^(reviewer|infra-reviewer|ui-reviewer)(-[a-zA-Z0-9-]+)?-[0-9]+$' \
      || deny "DENY: 'git push' は reviewer 系のみ。実装系は 'bash scripts/push-verified.sh' 経由で。"
  fi
fi

# ─── SendMessage: spec 直送 / mockup 未承認 / 長文ガード ───
if [ "$TOOL_NAME" = "SendMessage" ]; then
  TO=$(echo "$TOOL_INPUT" | jq -r '.to // ""')
  CONTENT=$(echo "$TOOL_INPUT" | jq -r '.message // ""')
  SENDER="${DETECTED_AGENT_NAME}"
  IS_ORCHESTRATOR=false
  [ -z "$SENDER" ] && IS_ORCHESTRATOR=true

  # [C-1b] ui-designer → ui-reviewer の impl-ready は mockup-approved フラグ必要
  if echo "$SENDER" | grep -qE '^ui-designer(-[a-zA-Z0-9-]+)?-[0-9]+$' \
     && echo "$TO" | grep -qE '^ui-reviewer(-[a-zA-Z0-9-]+)?-[0-9]+$' \
     && echo "$CONTENT" | grep -qE '^impl-ready:'; then
    if [[ "$SENDER" =~ -([0-9]+)$ ]]; then
      ISSUE_NUM="${BASH_REMATCH[1]}"
    else
      ISSUE_NUM=""
    fi
    check_mockup_approval_flag "$ISSUE_NUM" 1800 \
      || deny "DENY: ui-designer Issue #${ISSUE_NUM}: mockup-approved-${ISSUE_NUM}.flag (30 分以内) が必要。先に MOCKUP_REVIEW_REQUEST で承認を取ってください。"
  fi

  # 例外: analyst 宛 / 補足訂正 / shutdown 系 protocol は exempt
  echo "$TO" | grep -qE '^analyst-[0-9]+$' && exit 0
  echo "$CONTENT" | grep -qE '^(補足:|訂正:|clarification:)' && exit 0
  echo "$CONTENT" | jq -e 'type=="object" and (.type|test("shutdown|plan_approval"))' &>/dev/null && exit 0

  # 以下は orchestrator のみ対象
  [ "$IS_ORCHESTRATOR" = "true" ] || exit 0

  # [Phase E] Secondary heuristic: DETECTED_AGENT_NAME が空でも TO が team-lead 以外なら
  # sub-agent 間通信（analyst→coder spec 送信など）と判断して許可する。
  # process tree 検出が失敗した場合のフォールバック。
  # NOTE: TO=team-lead の場合のみ orchestrator ガード（C-3a / C-12a）を適用する。
  if [ "$TO" != "team-lead" ]; then
    exit 0
  fi

  # [C-3a] orchestrator → analyst 以外への spec: 含む長文禁止（TO=team-lead の場合のみ）
  # TO=team-lead で spec: を送るケースは想定外だが念のため残す
  IMPL_PATTERN='^(coder|infra-engineer|ui-designer)(-[a-zA-Z0-9-]+)?-[0-9]+$'
  if echo "$TO" | grep -qE "$IMPL_PATTERN" && echo "$CONTENT" | grep -qE '^spec:'; then
    deny "DENY: orchestrator が spec: を実装系 (${TO}) に直送。spec 作成は analyst に依頼してください。"
  fi

  # [C-12a] spec キーワード検知（TO=team-lead の orchestrator のみ）
  if echo "$CONTENT" | grep -qE '(Phase [0-9]+[A-Z]?:|## Phase|設計原則[[:space:]]*\(絶対遵守\)|##[[:space:]]*(修正対象|変更対象|想定変更ファイル)[[:space:]]*[0-9]*)'; then
    deny "DENY: orchestrator が spec を直接書いた可能性。analyst に依頼してください。例外: 補足/訂正は analyst 宛 or '補足:'/'訂正:' プレフィックス。"
  fi

  # [C-12a] 1500 文字以上は analyst 以外への送信を禁止（TO=team-lead の orchestrator のみ）
  if [ "${#CONTENT}" -gt 1500 ]; then
    deny "DENY: orchestrator が 1500 文字以上を analyst 以外 (${TO}) に送信しようとしています。spec 作成は analyst に依頼してください。"
  fi
fi

exit 0
