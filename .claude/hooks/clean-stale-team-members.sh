#!/bin/bash
# SessionStart hook: active-issues チームから stale agent を除去する
#
# 判定ルール:
# 1. suffix 付き agent (issue-N-role-NUM) は無条件 stale
# 2. stdin JSON の session_id と config.json の leadSessionId が異なれば
#    team-lead 以外の全 member を wipe (leadSessionId も更新)
# 3. 残った issue-<N>-* member について PR 状態で stale 判定 (既存ロジック)

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
TEAM_CONFIG="$REPO_ROOT/.claude-user/teams/active-issues/config.json"
[ -f "$TEAM_CONFIG" ] || exit 0

command -v jq >/dev/null 2>&1 || exit 0
command -v gh >/dev/null 2>&1 || exit 0
gh auth token >/dev/null 2>&1 || exit 0

# ── Step 1: stdin から session_id を取得 ────────────────────────────────
STDIN_JSON=""
if read -t 0 2>/dev/null || true; then
  STDIN_JSON=$(cat 2>/dev/null || true)
fi

CURRENT_SESSION_ID=""
if [ -n "$STDIN_JSON" ]; then
  CURRENT_SESSION_ID=$(printf '%s' "$STDIN_JSON" | jq -r '.session_id // empty' 2>/dev/null || true)
fi

# ── Step 2: leadSessionId を config から取得 ────────────────────────────
LEAD_SESSION_ID=$(jq -r '.leadSessionId // empty' "$TEAM_CONFIG" 2>/dev/null || true)

# ── Step 3: suffix 付き agent の検出 ────────────────────────────────────
# issue-N-role-NUM 形式 (末尾に数値 suffix)
SUFFIX_PATTERN='^issue-[0-9]+-(analyst|coder|infra-engineer|ui-designer|reviewer|infra-reviewer|ui-reviewer|e2e-reviewer)-[0-9]+$'
SUFFIX_STALE_NAMES=""
SUFFIX_COUNT=0

ALL_MEMBER_NAMES=$(jq -r '.members[]?.name // empty' "$TEAM_CONFIG" 2>/dev/null || echo "")

while IFS= read -r name; do
  [ -z "$name" ] && continue
  if [[ "$name" =~ $SUFFIX_PATTERN ]]; then
    SUFFIX_STALE_NAMES="${SUFFIX_STALE_NAMES} ${name}"
    SUFFIX_COUNT=$((SUFFIX_COUNT + 1))
  fi
done <<< "$ALL_MEMBER_NAMES"

# ── Step 4: session 不一致チェック ────────────────────────────────────
SESSION_WIPE_COUNT=0
SESSION_WIPE_NAMES=""
SESSION_CHANGED=0

if [ -n "$CURRENT_SESSION_ID" ] && [ -n "$LEAD_SESSION_ID" ] &&    [ "$CURRENT_SESSION_ID" != "$LEAD_SESSION_ID" ]; then
  # 新セッション: team-lead 以外を全除去
  SESSION_CHANGED=1
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    if [ "$name" = "team-lead" ]; then
      continue
    fi
    # suffix stale と重複しないようカウントのみ
    if [[ ! " $SUFFIX_STALE_NAMES " == *" $name "* ]]; then
      SESSION_WIPE_NAMES="${SESSION_WIPE_NAMES} ${name}"
      SESSION_WIPE_COUNT=$((SESSION_WIPE_COUNT + 1))
    fi
  done <<< "$ALL_MEMBER_NAMES"
fi

# ── Step 5: leadSessionId が欠落している場合の補完 ─────────────────────
# session 比較をスキップしたが session_id は取得できた → 補完だけ行う
UPDATE_LEAD_SESSION=0
if [ -n "$CURRENT_SESSION_ID" ]; then
  UPDATE_LEAD_SESSION=1
fi

# ── Step 6: atomic write ────────────────────────────────────────────────
TOTAL_WIPE_EARLY=$((SUFFIX_COUNT + SESSION_WIPE_COUNT))

if [ "$TOTAL_WIPE_EARLY" -gt 0 ] || [ "$UPDATE_LEAD_SESSION" = "1" ]; then
  # stale names を JSON 配列に変換（空の場合は [] を確実に生成）
  COMBINED_STALE_NAMES=""
  for _n in $SUFFIX_STALE_NAMES $SESSION_WIPE_NAMES; do
    [ -n "$_n" ] && COMBINED_STALE_NAMES="${COMBINED_STALE_NAMES} ${_n}"
  done
  if [ -n "$COMBINED_STALE_NAMES" ]; then
    STALE_JSON=$(printf '%s\n' $COMBINED_STALE_NAMES | jq -R . | jq -s . 2>/dev/null || echo '[]')
  else
    STALE_JSON='[]'
  fi

  if [ "$UPDATE_LEAD_SESSION" = "1" ] && [ "$SESSION_CHANGED" = "1" ]; then
    jq --arg sid "$CURRENT_SESSION_ID"        --argjson stale "$STALE_JSON"        '.leadSessionId = $sid
        | .members |= map(select(.name as $n | ($stale | index($n)) == null))'        "$TEAM_CONFIG" > "${TEAM_CONFIG}.tmp" && mv "${TEAM_CONFIG}.tmp" "$TEAM_CONFIG"
  elif [ "$UPDATE_LEAD_SESSION" = "1" ]; then
    # 比較スキップだが session_id あり → leadSessionId を補完 + suffix 除去
    jq --arg sid "$CURRENT_SESSION_ID"        --argjson stale "$STALE_JSON"        '.leadSessionId = $sid
        | .members |= map(select(.name as $n | ($stale | index($n)) == null))'        "$TEAM_CONFIG" > "${TEAM_CONFIG}.tmp" && mv "${TEAM_CONFIG}.tmp" "$TEAM_CONFIG"
  else
    # session_id なし → suffix 除去のみ
    if [ "$SUFFIX_COUNT" -gt 0 ]; then
      jq --argjson stale "$STALE_JSON"          '.members |= map(select(.name as $n | ($stale | index($n)) == null))'          "$TEAM_CONFIG" > "${TEAM_CONFIG}.tmp" && mv "${TEAM_CONFIG}.tmp" "$TEAM_CONFIG"
    fi
  fi
fi

# ── Step 7: PR ベース判定 (既存ロジック、session-wipe 対象でなかった member) ──
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")
[ -n "$REPO_SLUG" ] || { exit 0; }

# wipe 後の最新 member リストで PR 判定
MEMBERS=$(jq -r '.members[]?.name // empty' "$TEAM_CONFIG" 2>/dev/null || echo "")
STALE_NAMES=""
REMOVED_COUNT=0

while IFS= read -r name; do
  [ -z "$name" ] && continue
  if [[ ! "$name" =~ ^issue-([0-9]+)- ]]; then
    continue
  fi
  ISSUE_NUM="${BASH_REMATCH[1]}"

  PR_STATE=$(gh pr list --repo "$REPO_SLUG" \
    --search "Issue #${ISSUE_NUM} in:body" \
    --state all --json state,mergedAt --jq '.[0] // empty' 2>/dev/null || echo "")

  if [ -z "$PR_STATE" ]; then
    PR_STATE=$(gh pr list --repo "$REPO_SLUG" \
      --search "head:issue/${ISSUE_NUM}/" \
      --state all --json state,mergedAt --jq '.[0] // empty' 2>/dev/null || echo "")
  fi

  if [ -z "$PR_STATE" ]; then
    BRANCH_EXISTS=$(git -C "$REPO_ROOT" branch -a 2>/dev/null | grep -c "issue/${ISSUE_NUM}/" || echo "0")
    if [ "$BRANCH_EXISTS" = "0" ]; then
      STALE_NAMES="${STALE_NAMES} ${name}"
      REMOVED_COUNT=$((REMOVED_COUNT + 1))
    fi
    continue
  fi

  STATE=$(echo "$PR_STATE" | jq -r '.state' 2>/dev/null || echo "")
  MERGED_AT=$(echo "$PR_STATE" | jq -r '.mergedAt // "null"' 2>/dev/null || echo "null")

  if [ "$STATE" = "MERGED" ] || { [ "$STATE" = "CLOSED" ] && [ "$MERGED_AT" = "null" ]; }; then
    STALE_NAMES="${STALE_NAMES} ${name}"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
  fi
done <<< "$MEMBERS"

if [ "$REMOVED_COUNT" -gt 0 ]; then
  STALE_JSON=$(printf '%s\n' $STALE_NAMES | jq -R . | jq -s .)
  jq --argjson stale "$STALE_JSON" \
    '.members |= map(select(.name as $n | ($stale | index($n)) == null))' \
    "$TEAM_CONFIG" > "${TEAM_CONFIG}.tmp" && \
    mv "${TEAM_CONFIG}.tmp" "$TEAM_CONFIG"
fi

# ── Step 8: summary メッセージ ────────────────────────────────────────
TOTAL_REMOVED=$((SUFFIX_COUNT + SESSION_WIPE_COUNT + REMOVED_COUNT))

if [ "$TOTAL_REMOVED" -gt 0 ] || [ "$SESSION_CHANGED" = "1" ]; then
  if [ "$SESSION_CHANGED" = "1" ]; then
    MSG="team config 清掃: session change 検知 (旧 ${LEAD_SESSION_ID:0:8}... → 新 ${CURRENT_SESSION_ID:0:8}...)、${TOTAL_REMOVED} 件除去 (suffix:${SUFFIX_COUNT} / session-wipe:${SESSION_WIPE_COUNT} / pr-based:${REMOVED_COUNT})"
  else
    MSG="team config 清掃: ${TOTAL_REMOVED} 件の stale agent を除去 (suffix:${SUFFIX_COUNT} / pr-based:${REMOVED_COUNT})"
  fi
  jq -n --arg msg "$MSG" '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$msg}}'
fi

exit 0
