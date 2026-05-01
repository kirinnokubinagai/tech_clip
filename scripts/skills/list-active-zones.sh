#!/usr/bin/env bash
# list-active-zones.sh: 現在 active な worktree の Issue 群から active zones を算出する
#
# 使い方:
#   bash scripts/skills/list-active-zones.sh [--json] [--exclude-issue <N>]
#
# 出力 (--json):
#   {"active_issues": [1083, 1085], "active_zones": ["api-auth", "api-migration"]}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CACHE_DIR="$REPO_ROOT/.claude/.zone-cache"
mkdir -p "$CACHE_DIR"

JSON_OUT=false
EXCLUDE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON_OUT=true; shift ;;
    --exclude-issue) EXCLUDE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

ACTIVE_ISSUES=()
while IFS= read -r LINE; do
  if [[ "$LINE" =~ branch[[:space:]]+refs/heads/issue/([0-9]+)/ ]]; then
    NUM="${BASH_REMATCH[1]}"
    if [ -z "$EXCLUDE" ] || [ "$NUM" != "$EXCLUDE" ]; then
      ACTIVE_ISSUES+=("$NUM")
    fi
  fi
done < <(git -C "$REPO_ROOT" worktree list --porcelain)

ALL_ZONES=()
for N in "${ACTIVE_ISSUES[@]}"; do
  CACHE_FILE="$CACHE_DIR/issue-$N.json"
  if [ -f "$CACHE_FILE" ] && [ "$(find "$CACHE_FILE" -mmin -1440 2>/dev/null)" ]; then
    ZONES=$(jq -r '.zones[]?' "$CACHE_FILE" 2>/dev/null)
  else
    DETECT_OUT=$(bash "$SCRIPT_DIR/detect-issue-zones.sh" --issue "$N" --json 2>/dev/null || echo '{"zones":[]}')
    echo "$DETECT_OUT" > "$CACHE_FILE"
    ZONES=$(echo "$DETECT_OUT" | jq -r '.zones[]?')
  fi
  while IFS= read -r Z; do
    [ -z "$Z" ] && continue
    ALL_ZONES+=("$Z")
  done <<< "$ZONES"
done

UNIQUE_ZONES=""
if [ "${#ALL_ZONES[@]}" -gt 0 ]; then
  UNIQUE_ZONES=$(printf '%s\n' "${ALL_ZONES[@]}" | sort -u | grep -v '^$' || true)
fi

if $JSON_OUT; then
  ISSUES_ARR="[]"
  if [ "${#ACTIVE_ISSUES[@]}" -gt 0 ]; then
    ISSUES_ARR=$(printf '%s\n' "${ACTIVE_ISSUES[@]}" | jq -R 'tonumber? // empty' | jq -s .)
  fi
  ZONES_ARR="[]"
  if [ -n "$UNIQUE_ZONES" ]; then
    ZONES_ARR=$(echo "$UNIQUE_ZONES" | jq -R . | jq -s 'map(select(. != ""))')
  fi
  jq -n \
    --argjson issues "$ISSUES_ARR" \
    --argjson zones "$ZONES_ARR" \
    '{active_issues: $issues, active_zones: $zones}'
else
  echo "active_issues: ${ACTIVE_ISSUES[*]:-none}"
  echo "active_zones: ${UNIQUE_ZONES//$'\n'/, }"
fi
