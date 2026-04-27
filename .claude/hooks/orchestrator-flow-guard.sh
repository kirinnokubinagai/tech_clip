#!/usr/bin/env bash
# PreToolUse hook: orchestrator のフロー逸脱を物理ブロック
#
# 検知・ブロック対象:
#   1. analyst なしで coder/reviewer を spawn (Agent tool)
#   2. AskUserQuestion なしで gh issue close (Bash tool)
#   3. reviewer 以外が gh pr merge (Bash tool)
#   4. force push (Bash tool)
#   5. mockup 未承認の ui-designer impl-ready 送信 (SendMessage tool) [C-1b]
#   6. orchestrator が spec: を実装エージェントへ直接送信 (SendMessage tool) [C-3a]
#   7. git push --no-verify (Bash tool) [C-5b]
#   8. reviewer 系以外の git push (Bash tool) [C-5c]

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}')

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
# CLAUDE_USER_ROOT はテスト時にオーバーライド可能（デフォルト: REPO_ROOT/.claude-user）
CLAUDE_USER_ROOT="${CLAUDE_USER_ROOT:-${REPO_ROOT}/.claude-user}"
TEAM_CONFIG="${CLAUDE_USER_ROOT}/teams/active-issues/config.json"

deny() {
  local msg="$1"
  echo "$msg" >&2
  printf '{"decision":"block","reason":"%s"}' "$msg"
  exit 2
}

# Agent tool intercept: analyst 省略検知 + reviewer 重複 spawn 防止
if [ "$TOOL_NAME" = "Agent" ]; then
  NAME=$(echo "$TOOL_INPUT" | jq -r '.name // ""')
  case "$NAME" in
    issue-[0-9]*-coder|issue-[0-9]*-coder-*|\
issue-[0-9]*-infra-engineer|issue-[0-9]*-infra-engineer-*|\
issue-[0-9]*-ui-designer|issue-[0-9]*-ui-designer-*|\
issue-[0-9]*-reviewer|issue-[0-9]*-reviewer-*|\
issue-[0-9]*-infra-reviewer|issue-[0-9]*-infra-reviewer-*|\
issue-[0-9]*-ui-reviewer|issue-[0-9]*-ui-reviewer-*)
      ISSUE_NUM=$(echo "$NAME" | grep -oE '^issue-[0-9]+' | grep -oE '[0-9]+')

      if [ -f "$TEAM_CONFIG" ]; then
        # analyst 省略検知
        ANALYST_NAME="issue-${ISSUE_NUM}-analyst"
        ANALYST_EXISTS=$(jq -r --arg n "$ANALYST_NAME" \
          '[.members[] | select(.name == $n)] | length' "$TEAM_CONFIG" 2>/dev/null || echo "0")
        if [ "$ANALYST_EXISTS" = "0" ]; then
          deny "DENY: Issue #${ISSUE_NUM} に analyst (${ANALYST_NAME}) が存在しません。CLAUDE.md 必須 spawn 順序に従い analyst を先に spawn してください。"
        fi

        # reviewer 重複 spawn 防止: spawn しようとしている名前が reviewer 系の場合
        case "$NAME" in
          issue-[0-9]*-reviewer-*|issue-[0-9]*-infra-reviewer-*|issue-[0-9]*-ui-reviewer-*)
            # -2, -3, ... のサフィックス付きは重複の可能性がある
            # ベース名（サフィックスなし）の reviewer が既に存在するか確認
            BASE_ROLE=$(echo "$NAME" | sed -E 's/^(issue-[0-9]+-[a-z-]*reviewer)-[0-9]+$/\1/')
            if [ "$BASE_ROLE" != "$NAME" ]; then
              REVIEWER_COUNT=$(jq -r --arg base "$BASE_ROLE" \
                '[.members[] | select(.name | startswith($base))] | length' "$TEAM_CONFIG" 2>/dev/null || echo "0")
              if [ "$REVIEWER_COUNT" -ge 1 ]; then
                deny "DENY: Issue #${ISSUE_NUM} に reviewer (${BASE_ROLE}) が既に ${REVIEWER_COUNT} 体存在します。新規 spawn の前に SendMessage で既存 reviewer に ping を送り、応答がない場合のみ再 spawn してください。CLAUDE.md 絶対ルール参照。"
              fi
            fi
            ;;
        esac
      else
        # team config が存在しない = active-issues チームが未作成。異常状態なので deny する
        deny "DENY: active-issues team config が存在しません。TeamCreate(\"active-issues\") を先に実行してください。"
      fi
      ;;
  esac
fi

# Bash tool intercept: 独断 close/merge/push
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // ""')

  # gh issue close は AskUserQuestion 事前確認が必要（5分以内のフラグが必要）
  if echo "$COMMAND" | grep -qE '^\s*gh\s+issue\s+close\s'; then
    FLAG_FILE=$(ls "${CLAUDE_USER_ROOT}/projects/"*/memory/tmp-last-askuserquestion.flag 2>/dev/null | head -1 || true)
    FLAG_VALID=false
    if [ -n "$FLAG_FILE" ] && [ -f "$FLAG_FILE" ]; then
      FLAG_TIME=$(cat "$FLAG_FILE" 2>/dev/null || echo "")
      if [ -n "$FLAG_TIME" ]; then
        FLAG_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${FLAG_TIME%Z}" +%s 2>/dev/null \
          || date -d "$FLAG_TIME" +%s 2>/dev/null \
          || echo 0)
        NOW_EPOCH=$(date +%s)
        ELAPSED=$((NOW_EPOCH - FLAG_EPOCH))
        if [ "$ELAPSED" -le 300 ]; then
          FLAG_VALID=true
        fi
      fi
    fi
    if [ "$FLAG_VALID" != "true" ]; then
      deny "DENY: 'gh issue close' は AskUserQuestion で事前確認してから 5 分以内に実行してください。CLAUDE.md 絶対ルール (ワークフロー逸脱)。"
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

  # [C-5b] git push --no-verify は AskUserQuestion で承認後 5 分以内のみ許可
  # 注意: コマンド先頭が git push で始まる場合のみチェック（commit メッセージ中の --no-verify を誤検知しないよう先頭 anchor）
  if echo "$COMMAND" | grep -qE '^\s*git\s+push\s+.*--no-verify'; then
    FLAG_FILE=$(ls "${CLAUDE_USER_ROOT}/projects/"*/memory/tmp-last-askuserquestion.flag 2>/dev/null | head -1 || true)
    FLAG_VALID=false
    if [ -n "$FLAG_FILE" ] && [ -f "$FLAG_FILE" ]; then
      FLAG_TIME=$(cat "$FLAG_FILE" 2>/dev/null || echo "")
      if [ -n "$FLAG_TIME" ]; then
        FLAG_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${FLAG_TIME%Z}" +%s 2>/dev/null \
          || date -d "$FLAG_TIME" +%s 2>/dev/null \
          || echo 0)
        NOW_EPOCH=$(date +%s)
        ELAPSED=$((NOW_EPOCH - FLAG_EPOCH))
        if [ "$ELAPSED" -le 300 ]; then
          FLAG_VALID=true
        fi
      fi
    fi
    if [ "$FLAG_VALID" != "true" ]; then
      deny "DENY: 'git push --no-verify' は AskUserQuestion で事前確認してから 5 分以内に実行してください。CLAUDE.md 絶対ルール参照。"
    fi
  fi

  # [C-5c] git push は reviewer 系 agent または push-verified.sh 経由のみ許可
  if echo "$COMMAND" | grep -qE '^\s*git\s+push\s'; then
    # push-verified.sh 経由は exempt
    if echo "$COMMAND" | grep -qE 'push-verified\.sh'; then
      : # exempt
    else
      # reviewer 系 agent 以外からの git push をブロック
      if [ -z "${CLAUDE_AGENT_NAME:-}" ] || \
         ! echo "${CLAUDE_AGENT_NAME}" | grep -qE '^issue-[0-9]+-(reviewer|infra-reviewer|ui-reviewer)([-]|$)'; then
        deny "DENY: 'git push' は reviewer 系 agent (reviewer / infra-reviewer / ui-reviewer) のみ直接実行可能です。実装エージェントは 'bash scripts/push-verified.sh' 経由で依頼してください (CLAUDE_AGENT_NAME=${CLAUDE_AGENT_NAME:-unset})。"
      fi
    fi
  fi
fi

# SendMessage tool intercept: orchestrator が spec 相当の内容を直接送信するのを防止 / mockup 未承認ガード
if [ "$TOOL_NAME" = "SendMessage" ]; then
  MSG_TO=$(echo "$TOOL_INPUT" | jq -r '.to // ""')
  MSG_CONTENT=$(echo "$TOOL_INPUT" | jq -r '.message // ""')

  # sender 判定: CLAUDE_AGENT_NAME が空 = orchestrator
  SENDER_NAME="${CLAUDE_AGENT_NAME:-}"
  IS_ORCHESTRATOR=false
  if [ -z "$SENDER_NAME" ]; then
    IS_ORCHESTRATOR=true
  fi

  # [C-1b] ui-designer から ui-reviewer への impl-ready は mockup-approved-{N} フラグが必要
  if echo "$SENDER_NAME" | grep -qE '^issue-[0-9]+-ui-designer'; then
    if echo "$MSG_TO" | grep -qE '^issue-[0-9]+-ui-reviewer'; then
      if echo "$MSG_CONTENT" | grep -qE '^impl-ready:'; then
        ISSUE_NUM=$(echo "$SENDER_NAME" | grep -oE '[0-9]+' | head -1)
        FLAG_PATH=$(ls "${CLAUDE_USER_ROOT}/projects/"*/memory/mockup-approved-${ISSUE_NUM}.flag 2>/dev/null | head -1 || true)
        FLAG_VALID=false
        if [ -n "$FLAG_PATH" ] && [ -f "$FLAG_PATH" ]; then
          FLAG_TIME=$(cat "$FLAG_PATH" 2>/dev/null || echo "")
          if [ -n "$FLAG_TIME" ]; then
            FLAG_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${FLAG_TIME%Z}" +%s 2>/dev/null \
              || date -d "$FLAG_TIME" +%s 2>/dev/null \
              || echo 0)
            NOW_EPOCH=$(date +%s)
            ELAPSED=$((NOW_EPOCH - FLAG_EPOCH))
            if [ "$ELAPSED" -le 1800 ]; then
              FLAG_VALID=true
            fi
          fi
        fi
        if [ "$FLAG_VALID" != "true" ]; then
          deny "DENY: ui-designer (Issue #${ISSUE_NUM}) は ui-reviewer に impl-ready を送る前に MOCKUP_REVIEW_REQUEST で orchestrator → user 承認を取得する必要があります。30分以内の mockup-approved-${ISSUE_NUM}.flag が見つかりません。"
        fi
      fi
    fi
  fi

  # analyst 宛 または 補足系プレフィックスは以降のチェックを exempt
  if echo "$MSG_TO" | grep -qE '^issue-[0-9]+-analyst$'; then
    exit 0
  fi

  # 先頭が補足/訂正/clarification の場合は exempt
  if echo "$MSG_CONTENT" | grep -qE '^(補足:|訂正:|clarification:)'; then
    exit 0
  fi

  # shutdown_request / shutdown_response / plan_approval_response 等の protocol 構造体は exempt
  if echo "$MSG_CONTENT" | jq -e 'type == "object" and (.type | test("shutdown|plan_approval"))' &>/dev/null 2>&1; then
    exit 0
  fi

  # sender 判定: CLAUDE_AGENT_NAME が空 = orchestrator
  IS_ORCHESTRATOR=false
  if [ -z "${CLAUDE_AGENT_NAME:-}" ]; then
    IS_ORCHESTRATOR=true
  fi

  # [C-3a] orchestrator が実装エージェントへ spec: プレフィックスのメッセージを直接送信するのをブロック
  # orchestrator (CLAUDE_AGENT_NAME が空) が対象
  if [ "$IS_ORCHESTRATOR" = "true" ]; then
    IMPL_AGENT_PATTERN='^issue-[0-9]+-(coder|infra-engineer|ui-designer)([-]|$)'
    if echo "$MSG_TO" | grep -qE "$IMPL_AGENT_PATTERN"; then
      if echo "$MSG_CONTENT" | grep -qE '^spec:'; then
        deny "DENY: orchestrator が実装エージェント (${MSG_TO}) に 'spec:' を直接送信しようとしています。spec の作成は analyst (issue-{N}-analyst) に依頼し、analyst から実装エージェントへ渡してください。CLAUDE.md 絶対ルール参照。"
      fi
    fi
  fi

  # [C-12a] spec 相当キーワードを検知してブロック (orchestrator のみ対象)
  # サブエージェント間通信は意図的に spec-related なメッセージを送ることがあるため除外
  if [ "$IS_ORCHESTRATOR" = "true" ]; then
    SPEC_PATTERN='(Phase [0-9]+[A-Z]?:|## Phase|設計原則[[:space:]]*\(絶対遵守\)|##[[:space:]]*(修正対象|変更対象|想定変更ファイル)[[:space:]]*[0-9]*)'
    if echo "$MSG_CONTENT" | grep -qE "$SPEC_PATTERN"; then
      deny "DENY: orchestrator が spec を直接書いた可能性があります。spec 作成は analyst (issue-{N}-analyst) に依頼してください。例外: 既存 spec への補足訂正なら analyst 宛 or '補足:'/'訂正:' prefix でメッセージを開始してください。"
    fi
  fi

  # [C-12a] 1500 文字以上の長大メッセージを analyst 以外へ送る場合はブロック (orchestrator のみ対象)
  # サブエージェント間通信は spec パスや CHANGES_REQUESTED 詳細など長大なメッセージを送ることがあるため除外
  if [ "$IS_ORCHESTRATOR" = "true" ]; then
    MSG_LEN=${#MSG_CONTENT}
    if [ "$MSG_LEN" -gt 1500 ]; then
      deny "DENY: orchestrator が 1500 文字以上の長大メッセージを analyst 以外 (${MSG_TO}) に送信しようとしています。spec 作成は analyst に依頼し、orchestrator は短い指示メッセージのみ送信してください。"
    fi
  fi
fi

exit 0
