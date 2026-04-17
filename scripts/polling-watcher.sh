#!/usr/bin/env bash
#
# polling-watcher.sh: orchestrator 主導 fallback polling
# Webhook が配信されない場合の 2 層防御として、.omc/polling/*.json を読んで
# 各 PR の verdict を evaluate し確定したら agent に通知する。
#
# 使い方:
#   bash scripts/polling-watcher.sh [worktree_path]
#
# .omc/polling/pr-<PR_NUMBER>.json の形式:
#   {
#     "pr_number": 123,
#     "push_sha": "abc1234",
#     "issue_number": 1052,
#     "agent_name": "issue-1052-reviewer",
#     "started_at": "2025-01-01T00:00:00Z"
#   }

set -euo pipefail

WORKTREE="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
POLLING_DIR="$WORKTREE/.omc/polling"
CONFIG="$WORKTREE/.claude/config.json"

if [ ! -d "$POLLING_DIR" ]; then
  echo "polling dir not found: $POLLING_DIR"
  exit 0
fi

CI_NAME=$(jq -r '.ci_workflow_name' "$CONFIG" 2>/dev/null || echo "CI")
JOB_NAME=$(jq -r '.claude_review_job_name' "$CONFIG" 2>/dev/null || echo "claude-review")
PASS_LABEL=$(jq -r '.ai_review_pass_label' "$CONFIG" 2>/dev/null || echo "AI Review: PASS")
NEEDS_LABEL=$(jq -r '.ai_review_needs_work_label' "$CONFIG" 2>/dev/null || echo "AI Review: NEEDS WORK")
TIMEOUT_MINUTES=$(jq -r '.polling_timeout_minutes' "$CONFIG" 2>/dev/null || echo "60")
TIMEOUT_SECONDS=$((TIMEOUT_MINUTES * 60))

OWNER=$(gh repo view --json owner --jq .owner.login 2>/dev/null || echo "")
REPO=$(gh repo view --json name --jq .name 2>/dev/null || echo "")

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "ERROR: gh repo view failed"
  exit 1
fi

/**
 * 3 条件 AND で verdict を評価する
 * @param PR_NUMBER  - PR 番号
 * @param PUSH_SHA   - push 後の HEAD commit SHA
 * @returns "approve" | "request_changes" | "" (未確定)
 */
evaluate_verdict() {
  local PR_NUMBER="$1"
  local PUSH_SHA="$2"

  # 条件 1: 対象 commit の CI workflow run が completed
  local RUN
  RUN=$(gh api "repos/$OWNER/$REPO/actions/runs?head_sha=$PUSH_SHA&per_page=20" \
    --jq "[.workflow_runs[] | select(.name == \"$CI_NAME\") | select(.event == \"pull_request\")] | .[0]" 2>/dev/null || echo "null")
  [ "$RUN" = "null" ] || [ -z "$RUN" ] && return 0
  local RUN_ID RUN_STATUS RUN_CONCLUSION
  RUN_ID=$(echo "$RUN" | jq -r .id)
  RUN_STATUS=$(echo "$RUN" | jq -r .status)
  RUN_CONCLUSION=$(echo "$RUN" | jq -r .conclusion)
  [ "$RUN_STATUS" = "completed" ] || return 0
  [ "$RUN_CONCLUSION" != "cancelled" ] || return 0

  # 条件 2: claude-review job が終了
  local CR_JOB CR_CONCLUSION CR_COMPLETED
  CR_JOB=$(gh api "repos/$OWNER/$REPO/actions/runs/$RUN_ID/jobs" \
    --jq "[.jobs[] | select(.name == \"$JOB_NAME\")] | .[0]" 2>/dev/null || echo "null")
  [ "$CR_JOB" = "null" ] || [ -z "$CR_JOB" ] && return 0
  CR_CONCLUSION=$(echo "$CR_JOB" | jq -r .conclusion)
  case "$CR_CONCLUSION" in success|failure) ;; *) return 0 ;; esac
  CR_COMPLETED=$(echo "$CR_JOB" | jq -r .completed_at)

  # 条件 3-a: AI Review ラベル付与
  local LABELS
  LABELS=$(gh pr view "$PR_NUMBER" --json labels --jq '[.labels[].name]' 2>/dev/null || echo "[]")
  echo "$LABELS" | jq -e --arg p "$PASS_LABEL" --arg n "$NEEDS_LABEL" 'map(. == $p or . == $n) | any' >/dev/null 2>&1 || return 0

  # 条件 3-b: claude-review 判定コメント（CR 完了後かつ判定マーカーあり）
  local NEW BODY
  NEW=$(gh pr view "$PR_NUMBER" --json comments --jq --arg t "$CR_COMPLETED" '[
    .comments[] | select(.author.login == "claude") | select(.createdAt >= $t) | select(.body | contains("## PRレビュー結果"))
  ] | last' 2>/dev/null || echo "null")
  [ "$NEW" = "null" ] || [ -z "$NEW" ] && return 0
  BODY=$(echo "$NEW" | jq -r .body)

  if echo "$BODY" | grep -qE '(\*\*)?✅ Approve(\*\*)?|全件 PASS（0件）'; then
    echo "approve"
    return 0
  fi
  if echo "$BODY" | grep -qE '(\*\*)?🔄 Request Changes(\*\*)?|(\*\*)?💬 Comment(\*\*)?'; then
    echo "request_changes"
    return 0
  fi
  return 0
}

for STATE_FILE in "$POLLING_DIR"/pr-*.json; do
  [ -f "$STATE_FILE" ] || continue

  PR_NUMBER=$(jq -r .pr_number "$STATE_FILE" 2>/dev/null || echo "")
  PUSH_SHA=$(jq -r .push_sha "$STATE_FILE" 2>/dev/null || echo "")
  ISSUE_NUMBER=$(jq -r .issue_number "$STATE_FILE" 2>/dev/null || echo "")
  AGENT_NAME=$(jq -r .agent_name "$STATE_FILE" 2>/dev/null || echo "")
  STARTED_AT=$(jq -r .started_at "$STATE_FILE" 2>/dev/null || echo "")

  [ -z "$PR_NUMBER" ] || [ -z "$PUSH_SHA" ] || [ -z "$AGENT_NAME" ] && continue

  # タイムアウト確認
  if [ -n "$STARTED_AT" ]; then
    STARTED_EPOCH=$(date -d "$STARTED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$STARTED_AT" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    ELAPSED=$((NOW_EPOCH - STARTED_EPOCH))
    if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
      echo "TIMEOUT: PR #$PR_NUMBER ($AGENT_NAME) ${ELAPSED}秒経過"
      rm -f "$STATE_FILE"
      continue
    fi
  fi

  VERDICT=$(evaluate_verdict "$PR_NUMBER" "$PUSH_SHA")

  if [ -n "$VERDICT" ]; then
    echo "VERDICT: PR #$PR_NUMBER = $VERDICT (agent: $AGENT_NAME)"
    if [ "$VERDICT" = "approve" ]; then
      echo "POLLING_WATCHER_APPROVE: issue-$ISSUE_NUMBER PR #$PR_NUMBER" >> "$POLLING_DIR/watcher-results.log"
    elif [ "$VERDICT" = "request_changes" ]; then
      echo "POLLING_WATCHER_CHANGES: issue-$ISSUE_NUMBER PR #$PR_NUMBER" >> "$POLLING_DIR/watcher-results.log"
    fi
    # state ファイルを削除して二重処理を防ぐ
    rm -f "$STATE_FILE"
  else
    echo "PENDING: PR #$PR_NUMBER ($AGENT_NAME) verdict 未確定"
  fi
done
