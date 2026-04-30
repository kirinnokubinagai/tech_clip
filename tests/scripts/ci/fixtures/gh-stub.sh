#!/usr/bin/env bash
# gh CLI stub for auto-merge.bats tests
# Reads fixture files to determine behavior based on subcommand

set -uo pipefail

LOG_FILE="${GH_CALLS_LOG:-/dev/null}"
FIXTURE="${GH_FIXTURE_FILE:-}"

echo "gh $*" >> "$LOG_FILE"

# Parse: gh pr <subcommand> ...
if [[ "${1:-}" == "pr" ]]; then
  SUBCMD="${2:-}"

  if [[ "$SUBCMD" == "view" ]]; then
    VIEW_FILE="${FIXTURE}.view"
    VIEW_EXIT="${FIXTURE}.view.exit"
    if [[ -f "$VIEW_FILE" ]]; then
      cat "$VIEW_FILE"
    else
      echo '{"state":"OPEN","mergeStateStatus":"UNKNOWN","autoMergeRequest":null,"isDraft":false}'
    fi
    exit_code=0
    if [[ -f "$VIEW_EXIT" ]]; then
      exit_code=$(cat "$VIEW_EXIT")
    fi
    exit "$exit_code"
  fi

  if [[ "$SUBCMD" == "merge" ]]; then
    # Track call count using a counter file
    COUNT_FILE="${FIXTURE}.merge.count"
    count=0
    if [[ -f "$COUNT_FILE" ]]; then
      count=$(cat "$COUNT_FILE")
    fi
    count=$((count + 1))
    echo "$count" > "$COUNT_FILE"

    # Per-call exit code: .merge.<n>.exit
    EXIT_FILE="${FIXTURE}.merge.${count}.exit"
    exit_code=0
    if [[ -f "$EXIT_FILE" ]]; then
      exit_code=$(cat "$EXIT_FILE")
    fi

    # After merge is called, update view fixture if a post-merge view file exists
    POST_VIEW="${FIXTURE}.view.after_merge_${count}"
    if [[ -f "$POST_VIEW" ]]; then
      cp "$POST_VIEW" "${FIXTURE}.view"
    fi

    exit "$exit_code"
  fi
fi

# Default: unknown command, return error
echo "stub: unknown command: gh $*" >&2
exit 1
