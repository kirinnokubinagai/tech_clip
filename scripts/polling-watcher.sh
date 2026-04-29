#!/usr/bin/env bash
#
# polling-watcher.sh: reviewer 自己 polling（active polling 設計）
#
# reviewer が push 後に同期呼び出しする。内部で最大 9 分間 INTERVAL 秒毎に
# PR の verdict を評価し、stdout 最終行に結果を出力して exit する。
#
# 使い方:
#   bash scripts/polling-watcher.sh <PR_NUMBER> [worktree_path]
#
# stdout 出力（最終行のみが結果）:
#   VERDICT: approve PR #<N>
#   VERDICT: request_changes PR #<N>
#   VERDICT: external_merged PR #<N>
#   VERDICT: closed PR #<N>
#   VERDICT: conflict PR #<N>
#   VERDICT: timeout PR #<N> elapsed=<sec>s
#   VERDICT: error <reason>
#
# stderr には逐次の進捗 / debug を出す。
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

# 引数チェック
if [ $# -lt 1 ]; then
  echo "Usage: $0 <PR_NUMBER> [worktree_path]" >&2
  exit 1
fi

PR_NUMBER="$1"
WORKTREE="${2:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)}"
POLLING_DIR="$WORKTREE/.claude/polling"
CONFIG="$WORKTREE/.claude/config.json"
LIB="$SCRIPT_DIR/lib/evaluate-verdict.sh"

if [ ! -f "$LIB" ]; then
  echo "VERDICT: error evaluate-verdict.sh not found: $LIB"
  exit 0
fi
# shellcheck source=scripts/lib/evaluate-verdict.sh
source "$LIB"

# state ファイル確認
STATE_FILE="$POLLING_DIR/pr-${PR_NUMBER}.json"
if [ ! -f "$STATE_FILE" ]; then
  echo "VERDICT: error state_file_missing PR #${PR_NUMBER}"
  exit 0
fi

# state ファイル読み込み
PUSH_SHA=$(jq -r '.push_sha // ""' "$STATE_FILE" 2>/dev/null || echo "")
ISSUE_NUMBER=$(jq -r '.issue_number // ""' "$STATE_FILE" 2>/dev/null || echo "")
STARTED_AT=$(jq -r '.started_at // ""' "$STATE_FILE" 2>/dev/null || echo "")

if [ -z "$PUSH_SHA" ]; then
  echo "VERDICT: error invalid_state_file PR #${PR_NUMBER}"
  exit 0
fi

# タイムアウト設定
TIMEOUT_MINUTES=$(jq -r '.polling_timeout_minutes // 60' "$CONFIG" 2>/dev/null || echo "60")
TIMEOUT_SECONDS=$((TIMEOUT_MINUTES * 60))

# Fix F: 連続ポーリング — TIMEOUT まで内部ループを継続（still_pending 廃止）
# polling_interval_seconds を優先し、未設定なら 30 秒固定（polling_interval_minutes は廃止）
INTERVAL_SEC=$(jq -r '.polling_interval_seconds // 30' "$CONFIG" 2>/dev/null || echo "30")

LOG_FILE="$POLLING_DIR/watcher-results.log"

# started_at からの経過秒数を計算するヘルパー
elapsed_since_started() {
  if [ -z "$STARTED_AT" ]; then
    echo 0
    return
  fi
  local STARTED_EPOCH
  STARTED_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$STARTED_AT" +%s 2>/dev/null \
    || date -d "$STARTED_AT" +%s 2>/dev/null \
    || echo 0)
  local NOW_EPOCH
  NOW_EPOCH=$(date +%s)
  echo $((NOW_EPOCH - STARTED_EPOCH))
}

echo "INFO: polling PR #${PR_NUMBER} (issue: ${ISSUE_NUMBER}, sha: ${PUSH_SHA})" >&2

while :; do
  # 1) PR 全体状態（MERGED / CLOSED）を確認
  PR_STATE=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "")
  if [ "$PR_STATE" = "MERGED" ]; then
    echo "EXTERNAL_MERGED: PR #$PR_NUMBER" >&2
    echo "EXTERNAL_MERGED: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
    rm -f "$STATE_FILE"
    echo "VERDICT: external_merged PR #${PR_NUMBER}"
    exit 0
  fi
  if [ "$PR_STATE" = "CLOSED" ]; then
    echo "CLOSED: PR #$PR_NUMBER" >&2
    echo "CLOSED: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
    rm -f "$STATE_FILE"
    echo "VERDICT: closed PR #${PR_NUMBER}"
    exit 0
  fi

  # 2) mergeStateStatus チェック: DIRTY = conflict, BLOCKED = required check 失敗
  MERGE_STATE=$(gh pr view "$PR_NUMBER" --json mergeStateStatus --jq '.mergeStateStatus' 2>/dev/null || echo "")
  if [ "$MERGE_STATE" = "DIRTY" ]; then
    echo "CONFLICT: PR #$PR_NUMBER conflict with main" >&2
    echo "CONFLICT: issue-${ISSUE_NUMBER} PR #$PR_NUMBER mergeState=DIRTY at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
    # state は残す（conflict 解消後 reviewer が再呼び出し）
    echo "VERDICT: conflict PR #${PR_NUMBER}"
    exit 0
  fi
  if [ "$MERGE_STATE" = "BLOCKED" ]; then
    # BLOCKED は (a) CI 失敗 / (b) CI 進行中 / (c) review 未承認 のいずれも含む。
    # IN_PROGRESS / QUEUED な check が残っているうちは判定を保留する（still_pending 扱い）。
    IN_PROGRESS_COUNT=$(gh pr view "$PR_NUMBER" --json statusCheckRollup \
      --jq '[.statusCheckRollup[] | select(.status == "IN_PROGRESS" or .status == "QUEUED" or .status == "PENDING")] | length' 2>/dev/null || echo 0)
    if [ "$IN_PROGRESS_COUNT" -gt 0 ]; then
      echo "BLOCKED but ${IN_PROGRESS_COUNT} check(s) still IN_PROGRESS/QUEUED; treating as pending" >&2
      # fall through to evaluate_verdict / 内部 deadline 判定
    else
      echo "BLOCKED: PR #$PR_NUMBER required check failed (no remaining in-progress checks)" >&2
      echo "BLOCKED: issue-${ISSUE_NUMBER} PR #$PR_NUMBER mergeState=BLOCKED at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
      rm -f "$STATE_FILE"
      echo "VERDICT: request_changes PR #${PR_NUMBER}"
      exit 0
    fi
  fi

  # 3) TIMEOUT 確認（state.started_at + polling_timeout_minutes）
  ELAPSED=$(elapsed_since_started)
  if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
    echo "TIMEOUT: PR #$PR_NUMBER ${ELAPSED}s elapsed" >&2
    echo "TIMEOUT: issue-${ISSUE_NUMBER} PR #$PR_NUMBER elapsed=${ELAPSED}s at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
    rm -f "$STATE_FILE"
    echo "VERDICT: timeout PR #${PR_NUMBER} elapsed=${ELAPSED}s"
    exit 0
  fi

  # 4) 3条件AND verdict
  V=$(evaluate_verdict "$PR_NUMBER" "$PUSH_SHA" "$CONFIG")
  echo "INFO: evaluate_verdict -> $V (PR #${PR_NUMBER})" >&2

  case "$V" in
    approve)
      # 全 workflow PASS 後も mergeStateStatus が CLEAN/UNSTABLE/HAS_HOOKS でなければ pending 継続
      FINAL_MERGE_STATE=$(gh pr view "$PR_NUMBER" --json mergeStateStatus --jq '.mergeStateStatus' 2>/dev/null || echo "")
      if [ "$FINAL_MERGE_STATE" != "CLEAN" ] && [ "$FINAL_MERGE_STATE" != "UNSTABLE" ] && [ "$FINAL_MERGE_STATE" != "HAS_HOOKS" ]; then
        echo "INFO: evaluate_verdict=approve but mergeStateStatus=$FINAL_MERGE_STATE; treating as pending" >&2
        # fall through to sleep/retry
      else
        echo "POLLING_WATCHER_APPROVE: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
        rm -f "$STATE_FILE"
        echo "VERDICT: approve PR #${PR_NUMBER}"
        exit 0
      fi
      ;;
    request_changes)
      echo "POLLING_WATCHER_CHANGES: issue-${ISSUE_NUMBER} PR #$PR_NUMBER at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
      rm -f "$STATE_FILE"
      echo "VERDICT: request_changes PR #${PR_NUMBER}"
      exit 0
      ;;
    pending)
      echo "PENDING: PR #$PR_NUMBER verdict 未確定" >&2
      ;;
  esac

  sleep "$INTERVAL_SEC"
done
