#!/usr/bin/env bash
#
# polling-watcher.sh: orchestrator 主導ポーリング (Part C)
#
# Mac 稼働中前提。CronCreate (*/2 * * * *) または SessionStart hook で定期実行する。
# .claude/polling/*.json を読んで各 PR の verdict を評価し、
# 確定したら reviewer agent に SendMessage で通知する。
#
# 使い方:
#   bash scripts/polling-watcher.sh [worktree_path]
#
# .claude/polling/pr-<PR_NUMBER>.json の形式:
#   {
#     "pr_number": 123,
#     "push_sha": "abc1234",
#     "issue_number": 1052,
#     "agent_name": "issue-1052-reviewer",
#     "started_at": "2025-01-01T00:00:00Z"
#   }

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE="${1:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)}"
POLLING_DIR="$WORKTREE/.claude/polling"
CONFIG="$WORKTREE/.claude/config.json"
LIB="$SCRIPT_DIR/lib/evaluate-verdict.sh"

if [ ! -f "$LIB" ]; then
  echo "ERROR: evaluate-verdict.sh not found: $LIB" >&2
  exit 1
fi
# shellcheck source=scripts/lib/evaluate-verdict.sh
source "$LIB"

if [ ! -d "$POLLING_DIR" ]; then
  echo "polling dir not found: $POLLING_DIR"
  exit 0
fi

TIMEOUT_MINUTES=$(jq -r '.polling_timeout_minutes // 60' "$CONFIG" 2>/dev/null || echo "60")
TIMEOUT_SECONDS=$((TIMEOUT_MINUTES * 60))
TEAM_NAME="active-issues"

LOG_FILE="$POLLING_DIR/watcher-results.log"

# ---------------------------------------------------------------------------
# claude_send_message: チームの inbox ファイルに書き込んで SendMessage を擬似実装する
# ---------------------------------------------------------------------------
claude_send_message() {
  local target="$1"
  local message="$2"
  local inbox="${WORKTREE}/.claude-user/teams/${TEAM_NAME}/inboxes/${target}.jsonl"
  mkdir -p "$(dirname "$inbox")"
  jq -n \
    --arg to "$target" \
    --arg from "polling-watcher" \
    --arg msg "$message" \
    '{to: $to, from: $from, message: $msg, timestamp: (now | todate)}' >> "$inbox"
  echo "SendMessage -> $target: $message" >&2
}

for STATE_FILE in "$POLLING_DIR"/pr-*.json; do
  [ -f "$STATE_FILE" ] || continue

  PR_NUMBER=$(jq -r '.pr_number // ""' "$STATE_FILE" 2>/dev/null || echo "")
  PUSH_SHA=$(jq -r '.push_sha // ""' "$STATE_FILE" 2>/dev/null || echo "")
  ISSUE_NUMBER=$(jq -r '.issue_number // ""' "$STATE_FILE" 2>/dev/null || echo "")
  AGENT_NAME=$(jq -r '.agent_name // ""' "$STATE_FILE" 2>/dev/null || echo "")
  STARTED_AT=$(jq -r '.started_at // ""' "$STATE_FILE" 2>/dev/null || echo "")

  if [ -z "$PR_NUMBER" ] || [ -z "$PUSH_SHA" ] || [ -z "$AGENT_NAME" ]; then
    echo "SKIP: 不正な state ファイル: $STATE_FILE"
    continue
  fi

  # PR の状態確認（外部 merge / close チェック）
  PR_STATE=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "")
  if [ "$PR_STATE" = "MERGED" ]; then
    echo "EXTERNAL_MERGED: PR #$PR_NUMBER" >&2
    echo "EXTERNAL_MERGED: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
    claude_send_message "$AGENT_NAME" "VERDICT: external_merged PR #${PR_NUMBER} merged externally"
    rm -f "$STATE_FILE"
    continue
  fi
  if [ "$PR_STATE" = "CLOSED" ]; then
    echo "CLOSED: PR #$PR_NUMBER" >&2
    echo "CLOSED: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
    claude_send_message "$AGENT_NAME" "VERDICT: closed PR #${PR_NUMBER} closed without merge"
    rm -f "$STATE_FILE"
    continue
  fi

  # タイムアウト確認
  if [ -n "$STARTED_AT" ]; then
    STARTED_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$STARTED_AT" +%s 2>/dev/null \
      || date -d "$STARTED_AT" +%s 2>/dev/null \
      || echo 0)
    NOW_EPOCH=$(date +%s)
    ELAPSED=$((NOW_EPOCH - STARTED_EPOCH))
    if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
      echo "TIMEOUT: PR #$PR_NUMBER ($AGENT_NAME) ${ELAPSED}秒経過"
      echo "TIMEOUT: issue-${ISSUE_NUMBER} PR #$PR_NUMBER elapsed=${ELAPSED}s at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
      # タイムアウトは reviewer が死んでいる可能性があるため orchestrator へ送信する（CLAUDE.md:512）
      claude_send_message "orchestrator" "POLLING_TIMEOUT: issue-${ISSUE_NUMBER} PR #${PR_NUMBER} ${TIMEOUT_MINUTES}min exceeded"
      rm -f "$STATE_FILE"
      continue
    fi
  fi

  VERDICT=$(evaluate_verdict "$PR_NUMBER" "$PUSH_SHA" "$CONFIG")

  if [ "$VERDICT" = "pending" ]; then
    echo "PENDING: PR #$PR_NUMBER ($AGENT_NAME) verdict 未確定"
    continue
  fi

  echo "VERDICT: PR #$PR_NUMBER = $VERDICT (agent: $AGENT_NAME)"

  case "$VERDICT" in
    approve)
      echo "POLLING_WATCHER_APPROVE: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
      claude_send_message "$AGENT_NAME" "VERDICT: approve PR #${PR_NUMBER} passed"
      ;;
    request_changes)
      echo "POLLING_WATCHER_CHANGES: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
      claude_send_message "$AGENT_NAME" "VERDICT: request_changes PR #${PR_NUMBER}"
      ;;
  esac

  rm -f "$STATE_FILE"
done
