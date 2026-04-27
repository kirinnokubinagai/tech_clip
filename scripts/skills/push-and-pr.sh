#!/usr/bin/env bash
# push + PR 作成スクリプト
# 使用方法: WORKTREE=<path> ISSUE_NUMBER=<n> PR_TITLE=<title> bash scripts/skills/push-and-pr.sh
# 終了コード: 0=成功(PR_NUMBERをstdoutに出力), 1=push失敗, 2=remote hash mismatch
set -euo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"
ISSUE_NUMBER="${ISSUE_NUMBER:?ISSUE_NUMBER is required}"
PR_TITLE="${PR_TITLE:-}"

HEAD_SHA=$(git -C "$WORKTREE" rev-parse HEAD)

# .review-passed マーカー作成（HEAD SHA を書き込む）
mkdir -p "$WORKTREE/.claude"
printf '%s' "$HEAD_SHA" > "$WORKTREE/.claude/.review-passed"

# push
if ! (cd "$WORKTREE" && bash scripts/push-verified.sh); then
  echo "ERROR:push_failed"
  exit 1
fi

PR_BRANCH=$(git -C "$WORKTREE" rev-parse --abbrev-ref HEAD)
PR_NUMBER=$(gh pr list --head "$PR_BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")

# 新規 PR 作成
if [ -z "$PR_NUMBER" ]; then
  if [ -z "$PR_TITLE" ]; then
    ISSUE_TITLE=$(gh issue view "$ISSUE_NUMBER" --json title --jq '.title' 2>/dev/null || echo "fix: issue #$ISSUE_NUMBER")
    PR_TITLE="$ISSUE_TITLE"
  fi

  PR_URL=$(gh pr create \
    --title "$PR_TITLE" \
    --body "## 概要

Issue #${ISSUE_NUMBER} の対応。

## テスト

- [ ] pnpm lint パス
- [ ] pnpm typecheck パス
- [ ] pnpm test パス

Closes #${ISSUE_NUMBER}

🤖 Reviewed by reviewer agent")

  PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || \
    gh pr list --head "$PR_BRANCH" --json number --jq '.[0].number')
fi

# PUSH_REQUIRED: remote HEAD 再検証
REMOTE_HASH=$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid' 2>/dev/null || echo "")
if [ -n "$REMOTE_HASH" ] && [ "$HEAD_SHA" != "$REMOTE_HASH" ]; then
  echo "ERROR:remote_hash_mismatch:local=$HEAD_SHA:remote=$REMOTE_HASH"
  exit 2
fi

echo "OK:pr=$PR_NUMBER"
exit 0
