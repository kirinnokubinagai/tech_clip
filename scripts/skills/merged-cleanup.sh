#!/usr/bin/env bash
# PR マージ後の後片付けスクリプト
# 使用方法: WORKTREE=<path> ISSUE_NUMBER=<n> PR_NUMBER=<n> bash scripts/skills/merged-cleanup.sh
# 終了コード: 0=全成功, 1=worktree削除失敗(要手動)
set -uo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"
ISSUE_NUMBER="${ISSUE_NUMBER:?ISSUE_NUMBER is required}"
PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"

MAIN_WT=$(git -C "$WORKTREE" worktree list --porcelain 2>/dev/null | head -1 | sed 's/^worktree //')

# 1. Issue クローズ
gh issue close "$ISSUE_NUMBER" \
  --comment "PR がマージされたため自動クローズしました（reviewer agent）" 2>/dev/null || true

# 2. worktree 削除
WORKTREE_REMOVE_OK=1
if ! git -C "$MAIN_WT" worktree remove "$WORKTREE" --force 2>/dev/null; then
  git -C "$MAIN_WT" worktree prune 2>/dev/null || true
  if ! git -C "$MAIN_WT" worktree remove "$WORKTREE" --force 2>/dev/null; then
    WT_BASENAME=$(basename "$WORKTREE")
    if [[ "$WT_BASENAME" =~ ^issue-[0-9]+ ]] && [[ "$WORKTREE" == /* ]] && [[ "$WORKTREE" != "/" ]]; then
      rm -rf "$WORKTREE" 2>/dev/null || true
      git -C "$MAIN_WT" worktree prune 2>/dev/null || true
    fi
    if [ -d "$WORKTREE" ]; then
      WORKTREE_REMOVE_OK=0
      echo "WORKTREE_REMOVE_FAILED:path=$WORKTREE"
    fi
  fi
fi

# 3. ローカルブランチ削除
BRANCH_NAME=$(git -C "$MAIN_WT" branch --list "issue/${ISSUE_NUMBER}/*" 2>/dev/null | head -1 | tr -d ' *')
if [ -n "$BRANCH_NAME" ]; then
  git -C "$MAIN_WT" branch -D "$BRANCH_NAME" 2>/dev/null || true
fi

# 4. /tmp の temp ファイル削除
rm -f /tmp/issue-${ISSUE_NUMBER}-* 2>/dev/null || true

# 5. team config から Issue 関連エージェントを除去
TEAM_CONFIG="$MAIN_WT/.claude-user/teams/active-issues/config.json"
if [ -f "$TEAM_CONFIG" ] && command -v jq >/dev/null 2>&1; then
  jq --arg pattern "issue-${ISSUE_NUMBER}-" \
    '.members |= map(select(.name | startswith($pattern) | not))' \
    "$TEAM_CONFIG" > "${TEAM_CONFIG}.tmp" && \
    mv "${TEAM_CONFIG}.tmp" "$TEAM_CONFIG"
fi

if [ "$WORKTREE_REMOVE_OK" -eq 0 ]; then
  exit 1
fi

echo "OK:cleanup_done:issue=$ISSUE_NUMBER"
exit 0
