#!/usr/bin/env bash
# push 状態検証スクリプト
# 使用方法: WORKTREE=<path> ISSUE_NUMBER=<n> IMPL_AGENT_NAME=<name> IMPL_READY_HASH=<hash> bash scripts/skills/push-validation.sh
# 終了コード: 0=OK(PUSH_REQUIRED=false), 1=PUSH_REQUIRED=true, 2=エラー(hash不一致/uncommitted)
set -euo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"
IMPL_READY_HASH="${IMPL_READY_HASH:?IMPL_READY_HASH is required}"

LOCAL_HASH=$(git -C "$WORKTREE" rev-parse HEAD)

if [ "$LOCAL_HASH" != "$IMPL_READY_HASH" ]; then
  echo "ERROR:hash_mismatch:impl=$IMPL_READY_HASH:local=$LOCAL_HASH"
  exit 2
fi

UNCOMMITTED=$(git -C "$WORKTREE" status --porcelain)
if [ -n "$UNCOMMITTED" ]; then
  echo "ERROR:uncommitted_changes"
  exit 2
fi

PR_BRANCH=$(git -C "$WORKTREE" rev-parse --abbrev-ref HEAD)
PR_EXISTS=$(gh pr list --head "$PR_BRANCH" --json number --jq 'length' 2>/dev/null || echo 0)
if [ "$PR_EXISTS" -gt 0 ]; then
  PR_NUMBER=$(gh pr list --head "$PR_BRANCH" --json number --jq '.[0].number' 2>/dev/null)
  REMOTE_HASH=$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid' 2>/dev/null || echo "")
  if [ -n "$REMOTE_HASH" ] && [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
    echo "PUSH_REQUIRED:pr=$PR_NUMBER:local=$LOCAL_HASH:remote=$REMOTE_HASH"
    exit 1
  fi
fi

echo "OK:hash=$LOCAL_HASH"
exit 0
