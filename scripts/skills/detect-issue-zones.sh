#!/usr/bin/env bash
# detect-issue-zones.sh: Issue 番号から conflict zone を推定する
#
# 使い方:
#   bash scripts/skills/detect-issue-zones.sh --issue <N> [--json]
#   bash scripts/skills/detect-issue-zones.sh --text "<title + body>" [--json]
#
# 出力 (--json):
#   {"issue": 1083, "zones": ["api-auth", "api-migration"]}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SCRIPT_DIR}/../../.claude/config.json"

MODE=""
ISSUE_NUM=""
TEXT_INPUT=""
JSON_OUT=false

while [ $# -gt 0 ]; do
  case "$1" in
    --issue) MODE=issue; ISSUE_NUM="$2"; shift 2 ;;
    --text)  MODE=text;  TEXT_INPUT="$2"; shift 2 ;;
    --json)  JSON_OUT=true; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ "$MODE" = "issue" ]; then
  ISSUE_DATA=$(gh issue view "$ISSUE_NUM" --json title,body 2>/dev/null || echo '{}')
  TEXT=$(echo "$ISSUE_DATA" | jq -r '(.title // "") + " " + (.body // "")' | tr '[:upper:]' '[:lower:]')
elif [ "$MODE" = "text" ]; then
  TEXT=$(echo "$TEXT_INPUT" | tr '[:upper:]' '[:lower:]')
else
  echo "must pass --issue <N> or --text <text>" >&2
  exit 2
fi

ZONES_JSON=$(jq -r '.conflict_zones // {} | keys[]' "$CONFIG" 2>/dev/null)
HIT_ZONES=()

while IFS= read -r ZONE; do
  [ -z "$ZONE" ] && continue
  KEYWORDS=$(jq -r ".conflict_zones[\"$ZONE\"].keywords[]?" "$CONFIG" 2>/dev/null)
  FILES=$(jq -r ".conflict_zones[\"$ZONE\"].files[]?" "$CONFIG" 2>/dev/null)

  HIT=false
  while IFS= read -r KW; do
    [ -z "$KW" ] && continue
    KW_LOWER=$(echo "$KW" | tr '[:upper:]' '[:lower:]')
    if echo "$TEXT" | grep -qF "$KW_LOWER"; then HIT=true; break; fi
  done <<< "$KEYWORDS"

  if ! $HIT; then
    while IFS= read -r FP; do
      [ -z "$FP" ] && continue
      if echo "$TEXT" | grep -qF "$FP"; then HIT=true; break; fi
    done <<< "$FILES"
  fi

  if $HIT; then HIT_ZONES+=("$ZONE"); fi
done <<< "$ZONES_JSON"

if $JSON_OUT; then
  ZONES_ARR="[]"
  if [ "${#HIT_ZONES[@]}" -gt 0 ]; then
    ZONES_ARR=$(printf '%s\n' "${HIT_ZONES[@]}" | jq -R . | jq -s .)
  fi
  jq -n \
    --argjson issue "${ISSUE_NUM:-null}" \
    --argjson zones "$ZONES_ARR" \
    '{issue: $issue, zones: $zones}'
else
  printf '%s\n' "${HIT_ZONES[@]}"
fi
