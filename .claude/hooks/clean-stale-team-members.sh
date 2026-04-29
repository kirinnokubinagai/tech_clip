#!/bin/bash
# SessionStart hook: active-issues チームから stale agent を除去する
#
# 判定ルール（Fix D 改訂版 — 削除アプローチ）:
# 1. stdin JSON の session_id と config.json の leadSessionId が異なる場合
#    → config.json ごと rm して exit 0（orchestrator が TeamCreate で再作成）
# 2. leadSessionId が config に存在しない場合も同様に rm して exit 0
# 3. session 一致の場合: suffix 付き agent (issue-N-role-NUM) を jq で除去
# 4. session 一致の場合: PR ベース判定で closed/merged agent を除去

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
TEAM_CONFIG="$REPO_ROOT/.claude-user/teams/active-issues/config.json"
[ -f "$TEAM_CONFIG" ] || exit 0

command -v jq >/dev/null 2>&1 || exit 0

# ── Step 1: stdin から session_id を取得 ────────────────────────────────
STDIN_JSON=""
if read -t 0 2>/dev/null || true; then
  STDIN_JSON=$(cat 2>/dev/null || true)
fi

CURRENT_SESSION_ID=""
if [ -n "$STDIN_JSON" ]; then
  CURRENT_SESSION_ID=$(printf '%s' "$STDIN_JSON" | jq -r '.session_id // empty' 2>/dev/null || true)
fi

# ── Step 2: session boundary チェック → 不一致なら config.json を削除 ───
if [ -n "$CURRENT_SESSION_ID" ]; then
  LEAD_SESSION_ID=$(jq -r '.leadSessionId // empty' "$TEAM_CONFIG" 2>/dev/null || true)

  if [ -z "$LEAD_SESSION_ID" ] || [ "$CURRENT_SESSION_ID" != "$LEAD_SESSION_ID" ]; then
    # 新セッション or leadSessionId 欠落 → config.json 削除（orchestrator が TeamCreate で再作成）
    if [ -z "$LEAD_SESSION_ID" ]; then
      MSG="team config 清掃: leadSessionId 欠落 → config 削除 (orchestrator が再作成します)"
    else
      MSG="team config 清掃: session change 検知 (旧 ${LEAD_SESSION_ID:0:8}... → 新 ${CURRENT_SESSION_ID:0:8}...)、config 削除 (orchestrator が再作成します)"
    fi
    rm -f "$TEAM_CONFIG"
    jq -n --arg msg "$MSG" '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$msg}}'
    exit 0
  fi
fi

# ── Step 3: session 一致 — suffix 付き agent の除去 ─────────────────────
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

if [ "$SUFFIX_COUNT" -gt 0 ]; then
  STALE_JSON=$(printf '%s\n' $SUFFIX_STALE_NAMES | jq -R . | jq -s . 2>/dev/null || echo '[]')
  jq --argjson stale "$STALE_JSON" \
    '.members |= map(select(.name as $n | ($stale | index($n)) == null))' \
    "$TEAM_CONFIG" > "${TEAM_CONFIG}.tmp" && mv "${TEAM_CONFIG}.tmp" "$TEAM_CONFIG"
fi

# ── Step 4: PR ベース判定 ───────────────────────────────────────────────
command -v gh >/dev/null 2>&1 || exit 0
gh auth token >/dev/null 2>&1 || exit 0

REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")
[ -n "$REPO_SLUG" ] || exit 0

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

# ── Step 5: summary メッセージ ────────────────────────────────────────
TOTAL_REMOVED=$((SUFFIX_COUNT + REMOVED_COUNT))

if [ "$TOTAL_REMOVED" -gt 0 ]; then
  MSG="team config 清掃: ${TOTAL_REMOVED} 件の stale agent を除去 (suffix:${SUFFIX_COUNT} / pr-based:${REMOVED_COUNT})"
  jq -n --arg msg "$MSG" '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$msg}}'
fi

exit 0
