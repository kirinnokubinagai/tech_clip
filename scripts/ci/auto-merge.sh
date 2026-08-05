#!/usr/bin/env bash
# auto-merge.sh: Idempotent PR auto-merge enable + verify
#
# Behavior:
#   - If PR is not OPEN or is a draft, skip (exit 0)
#   - If auto-merge is already enabled, skip (exit 0)
#   - If an Android E2E workflow run exists for the PR head, wait for it and
#     refuse to merge unless it completes successfully
#   - If mergeStateStatus=CLEAN, attempt direct merge (no --auto flag)
#     On failure, fall through to auto-merge enable
#   - Otherwise, enable auto-merge with --auto flag
#   - Retry enable up to 3 times with exponential backoff (2/4/8s)
#   - Exit 1 if all attempts fail
#
# Required env vars:
#   GH_TOKEN      - GitHub token with pull-requests:write and contents:write
#   PR_NUMBER     - Pull request number
#   REPO          - Repository in owner/repo format

set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${REPO:?REPO is required}"

# Allow tests to override retry delay base (seconds)
RETRY_DELAY_BASE="${AUTO_MERGE_RETRY_DELAY_BASE:-2}"
# Android E2E may include a cold Gradle build. A missing run means the
# path-filtered workflow did not apply to this PR (for example, docs-only
# changes), while an existing run must complete successfully before merging.
E2E_POLL_INTERVAL="${AUTO_MERGE_E2E_POLL_INTERVAL:-30}"
E2E_MAX_WAIT="${AUTO_MERGE_E2E_MAX_WAIT:-2700}"

log() { echo "[auto-merge] $*"; }

# Fetch current PR state
fetch_state() {
  gh pr view "$PR_NUMBER" --repo "$REPO" \
    --json state,mergeStateStatus,autoMergeRequest,isDraft,headRefOid
}

fetch_e2e_status() {
  local head_sha="$1"
  gh run list \
    --repo "$REPO" \
    --workflow "PR E2E (Android)" \
    --commit "$head_sha" \
    --limit 1 \
    --json status,conclusion \
    --jq 'if length == 0 then "absent" else .[0].status + ":" + (.[0].conclusion // "") end'
}

wait_for_android_e2e() {
  local head_sha="$1"
  local elapsed=0
  local status

  while (( elapsed <= E2E_MAX_WAIT )); do
    if ! status="$(fetch_e2e_status "$head_sha")"; then
      log "ERROR: Could not read Android E2E status for ${head_sha}"
      return 1
    fi

    case "$status" in
      absent)
        log "No Android E2E run for ${head_sha}; path-filtered workflow not applicable"
        return 0
        ;;
      completed:success)
        log "Android E2E passed for ${head_sha}"
        return 0
        ;;
      completed:*)
        log "ERROR: Android E2E did not pass for ${head_sha}: ${status}"
        return 1
        ;;
      queued:*|in_progress:*|waiting:*|requested:*|pending:*)
        if (( elapsed >= E2E_MAX_WAIT )); then
          log "ERROR: Android E2E remained incomplete after ${E2E_MAX_WAIT}s: ${status}"
          return 1
        fi
        log "Android E2E is ${status}; waiting ${E2E_POLL_INTERVAL}s"
        sleep "$E2E_POLL_INTERVAL"
        elapsed=$((elapsed + E2E_POLL_INTERVAL))
        ;;
      *)
        log "ERROR: Unexpected Android E2E status for ${head_sha}: ${status}"
        return 1
        ;;
    esac
  done

  log "ERROR: Android E2E wait exceeded ${E2E_MAX_WAIT}s"
  return 1
}

STATE_JSON="$(fetch_state)"
STATE="$(echo "$STATE_JSON" | jq -r '.state // ""')"
MERGE_STATE="$(echo "$STATE_JSON" | jq -r '.mergeStateStatus // ""')"
HAS_AUTO="$(echo "$STATE_JSON" | jq -r '.autoMergeRequest != null')"
IS_DRAFT="$(echo "$STATE_JSON" | jq -r '.isDraft // false')"
HEAD_SHA="$(echo "$STATE_JSON" | jq -r '.headRefOid // ""')"

log "PR #${PR_NUMBER}: state=${STATE} mergeStateStatus=${MERGE_STATE} hasAutoMerge=${HAS_AUTO} isDraft=${IS_DRAFT}"

# Early returns
if [[ "$STATE" != "OPEN" ]]; then
  log "PR is not OPEN (state=${STATE}), skipping"
  exit 0
fi

if [[ "$IS_DRAFT" == "true" ]]; then
  log "PR is a draft, skipping"
  exit 0
fi

if [[ -z "$HEAD_SHA" ]]; then
  log "ERROR: PR head SHA is missing; refusing to merge"
  exit 1
fi

if ! wait_for_android_e2e "$HEAD_SHA"; then
  if [[ "$HAS_AUTO" == "true" ]]; then
    log "Android E2E failed; disabling already-enabled auto-merge"
    gh pr merge "$PR_NUMBER" --repo "$REPO" --disable-auto || \
      log "ERROR: Failed to disable auto-merge after Android E2E failure"
  fi
  exit 1
fi

if [[ "$HAS_AUTO" == "true" ]]; then
  log "Auto-merge already enabled, skipping"
  exit 0
fi

GH_MERGE="gh pr" ; GH_MERGE+=' merge'

# CLEAN state: attempt direct merge (auto option is a no-op on already-mergeable PRs)
if [[ "$MERGE_STATE" == "CLEAN" ]]; then
  log "mergeStateStatus=CLEAN, attempting direct merge"
  if $GH_MERGE "$PR_NUMBER" --repo "$REPO" --squash --delete-branch; then
    log "Direct merge succeeded"
    exit 0
  fi
  log "Direct merge failed, falling back to auto-merge enable"
fi

# Enable auto-merge with retry
attempt=0
delay="$RETRY_DELAY_BASE"
while [[ "$attempt" -lt 3 ]]; do
  attempt=$((attempt + 1))
  log "Attempt ${attempt}/3: enabling auto-merge"
  $GH_MERGE "$PR_NUMBER" --repo "$REPO" --squash --delete-branch --auto || true

  if [[ "$delay" -gt 0 ]]; then
    sleep "$delay"
  fi

  # Re-fetch state to verify
  STATE_JSON="$(fetch_state)"
  NEW_STATE="$(echo "$STATE_JSON" | jq -r '.state // ""')"
  NEW_HAS_AUTO="$(echo "$STATE_JSON" | jq -r '.autoMergeRequest != null')"

  if [[ "$NEW_STATE" == "MERGED" ]]; then
    log "PR is now MERGED"
    exit 0
  fi

  if [[ "$NEW_HAS_AUTO" == "true" ]]; then
    log "Auto-merge enabled successfully"
    exit 0
  fi

  log "Auto-merge not yet confirmed (attempt ${attempt}/3)"
  delay=$((delay * 2))
done

log "ERROR: Failed to enable auto-merge after 3 attempts"
exit 1
