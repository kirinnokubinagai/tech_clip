#!/usr/bin/env bash
#
# next-issue-auto-spawn.sh: APPROVED 通知受信後、次の Issue を自動提示する (Part F)
#
# orchestrator が reviewer から "APPROVED: issue-N" を受けたときに呼ぶ。
# 要人間確認 Issue を除いた自動割り当て可能 Issue 一覧を stdout に出力する。
#
# 使い方:
#   bash scripts/next-issue-auto-spawn.sh [--json]
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

OUTPUT_JSON=false
if [ "${1:-}" = "--json" ]; then
  OUTPUT_JSON=true
fi

# gh コマンドが使えるか確認
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh コマンドが見つかりません" >&2
  exit 1
fi

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

# 要人間確認フィルタ
AUTO_ASSIGNABLE=$(echo "$ISSUES_JSON" | jq -c '[
  .[] |
  select(
    ([.labels[].name] | index("release") | not) and
    ([.labels[].name] | index("requires-human") | not) and
    (.title | test("go-no-go|store|production|smoke test"; "i") | not) and
    (.title | contains("本番") | not)
  )
]')

REQUIRES_HUMAN=$(echo "$ISSUES_JSON" | jq -c '[
  .[] |
  select(
    ([.labels[].name] | index("release") != null) or
    ([.labels[].name] | index("requires-human") != null) or
    (.title | test("go-no-go|store|production|smoke test"; "i")) or
    (.title | contains("本番"))
  )
]')

if [ "$OUTPUT_JSON" = "true" ]; then
  echo "{\"auto_assignable\":$AUTO_ASSIGNABLE,\"requires_human\":$REQUIRES_HUMAN}"
  exit 0
fi

# テキスト形式で出力
AUTO_COUNT=$(echo "$AUTO_ASSIGNABLE" | jq 'length')
HUMAN_COUNT=$(echo "$REQUIRES_HUMAN" | jq 'length')

if [ "$AUTO_COUNT" -gt 0 ]; then
  echo "自動割り当て可能 Issue:"
  echo "$AUTO_ASSIGNABLE" | jq -r '.[] | "  #\(.number) \(.title)"'
else
  echo "自動割り当て可能 Issue: なし"
fi

echo ""

if [ "$HUMAN_COUNT" -gt 0 ]; then
  echo "要人間確認 Issue:"
  echo "$REQUIRES_HUMAN" | jq -r '.[] | "  #\(.number) \(.title)"'
fi
