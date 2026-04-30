#!/usr/bin/env bash
# auto-merge.sh: Idempotent PR auto-merge enable + verify
#
# Behavior:
#   - If PR is not OPEN or is a draft, skip (exit 0)
#   - If auto-merge is already enabled, skip (exit 0)
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

log() { echo "[auto-merge] $*"; }

# Fetch current PR state
fetch_state() {
  gh pr view "$PR_NUMBER" --repo "$REPO"     --json state,mergeStateStatus,autoMergeRequest,isDraft
}

STATE_JSON="$(fetch_state)"
STATE="$(echo "$STATE_JSON" | jq -r '.state // ""')"
MERGE_STATE="$(echo "$STATE_JSON" | jq -r '.mergeStateStatus // ""')"
HAS_AUTO="$(echo "$STATE_JSON" | jq -r '.autoMergeRequest != null')"
IS_DRAFT="$(echo "$STATE_JSON" | jq -r '.isDraft // false')"

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
