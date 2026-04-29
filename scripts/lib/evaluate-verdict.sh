#!/usr/bin/env bash
#
# evaluate-verdict.sh: 3条件AND で PR verdict を判定する共通関数ライブラリ
#
# 使い方:
#   source scripts/lib/evaluate-verdict.sh
#   VERDICT=$(evaluate_verdict "$PR_NUMBER" "$PUSH_SHA" "$CONFIG_FILE")
#
# 戻り値:
#   "approve"          - 全条件クリア、Approve 相当
#   "request_changes"  - Changes Requested 相当
#   "pending"          - 未確定（再試行が必要）

set -euo pipefail

# ---------------------------------------------------------------------------
# evaluate_verdict <PR_NUMBER> <PUSH_SHA> [CONFIG]
#
# 3 条件 AND で verdict を評価する:
#   条件1: 対象 commit の CI workflow run が completed（cancelled 除く）
#   条件2: claude-review job が終了（success または failure）
#   条件3: AI Review ラベルが付与 かつ claude-review 完了後に判定コメントがある
# ---------------------------------------------------------------------------
evaluate_verdict() {
  local PR_NUMBER="$1"
  local PUSH_SHA="$2"
  local CONFIG="${3:-}"

  local CI_NAME JOB_NAME PASS_LABEL NEEDS_LABEL OWNER REPO

  if [ -n "$CONFIG" ] && [ -f "$CONFIG" ]; then
    CI_NAME=$(jq -r '.ci_workflow_name // "CI"' "$CONFIG")
    JOB_NAME=$(jq -r '.claude_review_job_name // "claude-review"' "$CONFIG")
    PASS_LABEL=$(jq -r '.ai_review_pass_label // "AI Review: PASS"' "$CONFIG")
    NEEDS_LABEL=$(jq -r '.ai_review_needs_work_label // "AI Review: NEEDS WORK"' "$CONFIG")
    APPROVE_PATTERN=$(jq -r '.verdict_patterns.approve // [] | join("|")' "$CONFIG" 2>/dev/null || echo "")
    CHANGES_PATTERN=$(jq -r '.verdict_patterns.request_changes // [] | join("|")' "$CONFIG" 2>/dev/null || echo "")
  else
    CI_NAME="CI"
    JOB_NAME="claude-review"
    PASS_LABEL="AI Review: PASS"
    NEEDS_LABEL="AI Review: NEEDS WORK"
    APPROVE_PATTERN=""
    CHANGES_PATTERN=""
  fi
  # フォールバック: config にパターンがない場合はデフォルト値を使用
  APPROVE_PATTERN="${APPROVE_PATTERN:-(\*\*)?✅ Approve(\*\*)?|全件 PASS（0件）}"
  CHANGES_PATTERN="${CHANGES_PATTERN:-(\*\*)?🔄 Request Changes(\*\*)?|(\*\*)?💬 Comment(\*\*)?}"

  OWNER=$(gh repo view --json owner --jq .owner.login 2>/dev/null || echo "")
  REPO=$(gh repo view --json name --jq .name 2>/dev/null || echo "")

  if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
    echo "pending"
    return 0
  fi

  # --- 条件1: 対象 commit の全 workflow run が completed かつ全件 success ---
  local RUN_JSON ALL_RUNS RUN RUN_ID RUN_STATUS RUN_CONCLUSION
  RUN_JSON=$(gh api "repos/$OWNER/$REPO/actions/runs?head_sha=$PUSH_SHA&per_page=100" 2>/dev/null || echo '{"workflow_runs":[]}')

  # PR に紐づく全 run を取得
  ALL_RUNS=$(echo "$RUN_JSON" | jq -c '[.workflow_runs[] | select(.event == "pull_request")]' 2>/dev/null || echo "[]")

  if [ "$ALL_RUNS" = "[]" ] || [ -z "$ALL_RUNS" ]; then
    echo "pending"
    return 0
  fi

  # 未完了の run が 1 件でもあれば pending
  local IN_PROGRESS_RUNS
  IN_PROGRESS_RUNS=$(echo "$ALL_RUNS" | jq -r '[.[] | select(.status != "completed")] | length' 2>/dev/null || echo "0")
  if [ "$IN_PROGRESS_RUNS" -gt 0 ]; then
    echo "pending"
    return 0
  fi

  # 失敗・キャンセル系の run があれば即判定
  local CANCELLED_RUNS FAILED_RUNS
  CANCELLED_RUNS=$(echo "$ALL_RUNS" | jq -r '[.[] | select(.conclusion == "cancelled")] | length' 2>/dev/null || echo "0")
  if [ "$CANCELLED_RUNS" -gt 0 ]; then
    echo "pending"
    return 0
  fi

  FAILED_RUNS=$(echo "$ALL_RUNS" | jq -r '[.[] | select(.conclusion | . == "failure" or . == "timed_out" or . == "startup_failure" or . == "action_required")] | length' 2>/dev/null || echo "0")
  if [ "$FAILED_RUNS" -gt 0 ]; then
    echo "request_changes"
    return 0
  fi

  # CI ワークフロー run の ID を取得（条件2のジョブ確認に使用）
  RUN=$(echo "$ALL_RUNS" | jq -r "[.[] | select(.name == \"$CI_NAME\")] | .[0]" 2>/dev/null || echo "null")
  if [ "$RUN" = "null" ] || [ -z "$RUN" ]; then
    echo "pending"
    return 0
  fi

  RUN_ID=$(echo "$RUN" | jq -r '.id // empty' 2>/dev/null || echo "")
  RUN_STATUS=$(echo "$RUN" | jq -r '.status // empty' 2>/dev/null || echo "")
  RUN_CONCLUSION=$(echo "$RUN" | jq -r '.conclusion // empty' 2>/dev/null || echo "")

  if [ -z "$RUN_ID" ]; then
    echo "pending"
    return 0
  fi

  # --- 条件2: claude-review job が終了 ---
  local JOBS_JSON CR_JOB CR_CONCLUSION CR_COMPLETED
  JOBS_JSON=$(gh api "repos/$OWNER/$REPO/actions/runs/$RUN_ID/jobs" 2>/dev/null || echo '{"jobs":[]}')
  CR_JOB=$(echo "$JOBS_JSON" | jq -r "[.jobs[] | select(.name == \"$JOB_NAME\")] | .[0]" 2>/dev/null || echo "null")

  if [ "$CR_JOB" = "null" ] || [ -z "$CR_JOB" ]; then
    echo "pending"
    return 0
  fi

  CR_CONCLUSION=$(echo "$CR_JOB" | jq -r '.conclusion // empty' 2>/dev/null || echo "")
  case "$CR_CONCLUSION" in
    success|failure) ;;
    *)
      echo "pending"
      return 0
      ;;
  esac
  CR_COMPLETED=$(echo "$CR_JOB" | jq -r '.completed_at // ""' 2>/dev/null || echo "")

  # --- 条件3-a: AI Review ラベル付与 ---
  local LABELS_JSON LABELS HAS_REVIEW_LABEL
  LABELS_JSON=$(gh pr view "$PR_NUMBER" --repo "$OWNER/$REPO" --json labels 2>/dev/null || echo '{"labels":[]}')
  LABELS=$(echo "$LABELS_JSON" | jq -r '[.labels[].name]' 2>/dev/null || echo "[]")

  HAS_REVIEW_LABEL=$(echo "$LABELS" | jq -r \
    --arg p "$PASS_LABEL" --arg n "$NEEDS_LABEL" \
    'map(. == $p or . == $n) | any' 2>/dev/null || echo "false")

  if [ "$HAS_REVIEW_LABEL" != "true" ]; then
    echo "pending"
    return 0
  fi

  # --- 条件3-b: claude-review 完了後の判定コメント ---
  # claude-review が success で完了し新コメントを投稿しなかった場合、既存ラベルで判定する
  local COMMENTS_JSON COMMENT BODY
  COMMENTS_JSON=$(gh pr view "$PR_NUMBER" --repo "$OWNER/$REPO" --json comments 2>/dev/null || echo '{"comments":[]}')

  COMMENT=$(echo "$COMMENTS_JSON" | jq -r \
    --arg t "$CR_COMPLETED" \
    '[.comments[] | select(.author.login == "claude") | select(.createdAt >= $t) | select(.body | contains("## PRレビュー結果"))] | last' \
    2>/dev/null || echo "null")

  if [ "$COMMENT" = "null" ] || [ -z "$COMMENT" ]; then
    # 新コメントなし: claude-review success + PASS ラベルで approve、NEEDS WORK ラベルで request_changes
    if [ "$CR_CONCLUSION" = "success" ]; then
      HAS_PASS=$(echo "$LABELS" | jq -r --arg p "$PASS_LABEL" 'map(. == $p) | any' 2>/dev/null || echo "false")
      HAS_NEEDS=$(echo "$LABELS" | jq -r --arg n "$NEEDS_LABEL" 'map(. == $n) | any' 2>/dev/null || echo "false")
      if [ "$HAS_PASS" = "true" ]; then
        echo "approve"
        return 0
      fi
      if [ "$HAS_NEEDS" = "true" ]; then
        echo "request_changes"
        return 0
      fi
    fi
    echo "pending"
    return 0
  fi

  BODY=$(echo "$COMMENT" | jq -r '.body // ""' 2>/dev/null || echo "")

  if echo "$BODY" | grep -qE "$APPROVE_PATTERN"; then
    echo "approve"
    return 0
  fi

  if echo "$BODY" | grep -qE "$CHANGES_PATTERN"; then
    echo "request_changes"
    return 0
  fi

  echo "pending"
  return 0
}
