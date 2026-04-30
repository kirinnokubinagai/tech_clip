#!/usr/bin/env bash
# PreToolUse hook: orchestrator のフロー逸脱を物理ブロック
# ブロック対象:
#   1. analyst なし implementation/reviewer の Agent spawn
#   2. reviewer 系の重複 spawn
#   3. AskUserQuestion 未承認の gh issue close / git push --no-verify
#   4. force push
#   5. orchestrator が spec を実装エージェントへ直接送信
#
# 除去済み（CLAUDE_AGENT_NAME 依存除去のため）:
#   - gh pr merge の reviewer 限定（branch protection + reviewer agent 定義で代替）
#   - git push の reviewer 限定（pre-push-review-guard.sh + push-verified.sh で代替）
#   - ui-designer の mockup-approved フラグ確認（agent 定義プロンプトで代替）

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CLAUDE_USER_ROOT="${CLAUDE_USER_ROOT:-${REPO_ROOT}/.claude-user}"
TEAM_CONFIG="${CLAUDE_USER_ROOT}/teams/active-issues/config.json"

# shellcheck source=../../scripts/lib/askuserquestion-flag.sh
source "${REPO_ROOT}/scripts/lib/askuserquestion-flag.sh"

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}')

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

  # force push: 完全禁止
  if echo "$CMD" | grep -qE 'git\s+push\s+.*(-f[[:space:]]|--force[[:space:]]|-f$|--force$)'; then
    deny "DENY: force push 禁止。"
  fi

  # git push --no-verify: AskUserQuestion 5 分以内
  if echo "$CMD" | grep -qE '^\s*git\s+push\s+.*--no-verify'; then
    check_askuserquestion_flag 300 || deny "DENY: 'git push --no-verify' は AskUserQuestion で事前確認 (5 分以内) してから実行してください。"
  fi

fi

# ─── SendMessage: spec 直送 / mockup 未承認 / 長文ガード ───
# Sub-agent 間通信ポリシー (Issue #1146 で確定):
# - CLAUDE_AGENT_NAME 環境変数は SDK が inject しないため使用不可
# - DETECTED_AGENT_NAME は常に空、SENDER は常に空 = IS_ORCHESTRATOR=true 扱い
# - TO != "team-lead" は無条件 exempt (sub-agent 間通信は通す)
# - TO == "team-lead" は team active 時も SPEC_PATTERN / 1500 文字制限を維持
#   （sub-agent と orchestrator を区別不可なので安全側に倒し、両方を制限する）
# - sub-agent が team-lead に長文 STATE_UPDATE を送りたい場合は 1500 文字以内に分割すること
if [ "$TOOL_NAME" = "SendMessage" ]; then
  TO=$(echo "$TOOL_INPUT" | jq -r '.to // ""')
  CONTENT=$(echo "$TOOL_INPUT" | jq -r '.message // ""')
  IS_ORCHESTRATOR=true

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
