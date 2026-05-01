#!/usr/bin/env bash
#
# next-issue-candidates.sh: APPROVED 通知受信後、次の Issue 候補を提示する (Part F)
#
# orchestrator が reviewer から "APPROVED: issue-N" を受けたときに呼ぶ。
# 要人間確認 Issue を除いた自動割り当て可能 Issue 一覧を stdout に出力する。
# spawn 自体は orchestrator の責任であり、このスクリプトは候補リストのみを返す。
#
# 使い方:
#   bash scripts/next-issue-candidates.sh [--json]
#
# オプション:
#   --json  JSON 形式で出力（orchestrator が処理しやすい形式）
#
# 出力例（デフォルト）:
#   自動割り当て可能 Issue:
#     #1055 feat: Add search functionality
#     #1056 fix: Fix login error
#
#   要人間確認 Issue:
#     #1057 [release] v2.0.0 リリース準備

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SCRIPT_DIR}/../.claude/config.json"

OUTPUT_JSON=false
if [ "${1:-}" = "--json" ]; then
  OUTPUT_JSON=true
fi

# gh コマンドが使えるか確認
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh コマンドが見つかりません" >&2
  exit 1
fi

# config.json から要人間確認ラベルとタイトルパターンを読み込む
HUMAN_LABELS=$(jq -r '.human_review_labels // ["release","requires-human"] | map(@json) | join(",")' "$CONFIG" 2>/dev/null || echo '"release","requires-human"')
HUMAN_PATTERNS=$(jq -r '.human_review_title_patterns // ["go-no-go","store","production","smoke test","本番"] | join("|")' "$CONFIG" 2>/dev/null || echo 'go-no-go|store|production|smoke test|本番')

# Issue 一覧を取得
ISSUES_JSON=$(gh issue list --state open --limit 100 \
  --json number,title,labels 2>/dev/null || echo "[]")

if [ "$ISSUES_JSON" = "[]" ] || [ -z "$ISSUES_JSON" ]; then
  if [ "$OUTPUT_JSON" = "true" ]; then
    echo '{"auto_assignable":[],"requires_human":[]}'
  else
    echo "対応可能なオープン Issue はありません"
  fi
  exit 0
fi

# 要人間確認フィルタ（config.json の値を使用）
AUTO_ASSIGNABLE=$(echo "$ISSUES_JSON" | jq -c --argjson labels "[$HUMAN_LABELS]" --arg patterns "$HUMAN_PATTERNS" '[
  .[] |
  select(
    ([ .labels[].name ] | any(. as $l | $labels | index($l)) | not) and
    (.title | test($patterns; "i") | not)
  )
]')

REQUIRES_HUMAN=$(echo "$ISSUES_JSON" | jq -c --argjson labels "[$HUMAN_LABELS]" --arg patterns "$HUMAN_PATTERNS" '[
  .[] |
  select(
    ([ .labels[].name ] | any(. as $l | $labels | index($l))) or
    (.title | test($patterns; "i"))
  )
]')

# active zones を取得
ACTIVE_ZONES_JSON=$(bash "$SCRIPT_DIR/skills/list-active-zones.sh" --json 2>/dev/null || echo '{"active_issues":[],"active_zones":[]}')
ACTIVE_ZONES=$(echo "$ACTIVE_ZONES_JSON" | jq '.active_zones // []')
ACTIVE_ISSUES_LIST=$(echo "$ACTIVE_ZONES_JSON" | jq '.active_issues // []')

# 各 issue の zones を detect-issue-zones.sh で取得して付与
AUTO_ASSIGNABLE_FINAL="[]"
while IFS= read -r ISSUE_OBJ; do
  INUMBER=$(echo "$ISSUE_OBJ" | jq -r '.number')
  DETECT_OUT=$(bash "$SCRIPT_DIR/skills/detect-issue-zones.sh" --issue "$INUMBER" --json 2>/dev/null || echo '{"zones":[]}')
  ISSUE_ZONES=$(echo "$DETECT_OUT" | jq '.zones // []')

  INTERSECTION=$(jq -n \
    --argjson mine "$ISSUE_ZONES" \
    --argjson active "$ACTIVE_ZONES" \
    '$mine - ($mine - $active)')
  BLOCKED=$(jq -n --argjson inter "$INTERSECTION" '$inter | length > 0')

  ISSUE_FINAL=$(echo "$ISSUE_OBJ" | jq \
    --argjson zones "$ISSUE_ZONES" \
    --argjson blocked "$BLOCKED" \
    --argjson blocking "$INTERSECTION" \
    '. + {zones: $zones, blocked_by_active: $blocked, blocking_zones: $blocking}')

  AUTO_ASSIGNABLE_FINAL=$(echo "$AUTO_ASSIGNABLE_FINAL" | jq --argjson item "$ISSUE_FINAL" '. + [$item]')
done < <(echo "$AUTO_ASSIGNABLE" | jq -c '.[]')

if [ "$OUTPUT_JSON" = "true" ]; then
  jq -n \
    --argjson auto_assignable "$AUTO_ASSIGNABLE_FINAL" \
    --argjson requires_human "$REQUIRES_HUMAN" \
    --argjson active_zones "$ACTIVE_ZONES" \
    --argjson active_issues "$ACTIVE_ISSUES_LIST" \
    '{auto_assignable: $auto_assignable, requires_human: $requires_human, active_zones: $active_zones, active_issues: $active_issues}'
  exit 0
fi

# テキスト形式で出力
AUTO_COUNT=$(echo "$AUTO_ASSIGNABLE_FINAL" | jq 'length')
HUMAN_COUNT=$(echo "$REQUIRES_HUMAN" | jq 'length')

if [ "$AUTO_COUNT" -gt 0 ]; then
  echo "自動割り当て可能 Issue:"
  echo "$AUTO_ASSIGNABLE_FINAL" | jq -r '.[] | if .blocked_by_active then "  ⏸ #\(.number) \(.title) (ブロック中: \(.blocking_zones | join(", ")))" else "  ✅ #\(.number) \(.title)" end'
else
  echo "自動割り当て可能 Issue: なし"
fi

echo ""

if [ "$HUMAN_COUNT" -gt 0 ]; then
  echo "要人間確認 Issue:"
  echo "$REQUIRES_HUMAN" | jq -r '.[] | "  #\(.number) \(.title)"'
fi
