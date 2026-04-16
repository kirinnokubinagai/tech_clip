#!/bin/bash
# SessionStart hook: active-issues チームから stale agent を除去する
#
# 判定ルール:
# 1. name が "issue-<N>-*" 形式の member について
# 2. Issue #N の PR 状態を確認
# 3. PR が MERGED or CLOSED (merged_at == null) → 削除
# 4. PR が存在せず、かつ branch もない → 削除
# 5. 上記以外 → 残す

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
TEAM_CONFIG="$REPO_ROOT/.claude-user/teams/active-issues/config.json"
[ -f "$TEAM_CONFIG" ] || exit 0

command -v jq >/dev/null 2>&1 || exit 0
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
    '.members |= map(select(.name as $n | $stale | index($n) | not))' \
    "$TEAM_CONFIG" > "${TEAM_CONFIG}.tmp" && \
    mv "${TEAM_CONFIG}.tmp" "$TEAM_CONFIG"

  SUMMARY="team config 清掃: ${REMOVED_COUNT} 件の stale agent を除去 (${STALE_NAMES})"
  jq -n --arg msg "$SUMMARY" '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$msg}}'
fi

exit 0
