#!/bin/bash
# sync-roadmap.sh
# docs/ROADMAP.md と GitHub Issue の整合性を検証するスクリプト
#
# 使い方:
#   ./scripts/sync-roadmap.sh          # 検証のみ
#   ./scripts/sync-roadmap.sh --fix    # 状態(✅/🔲)を自動修正
#
# ROADMAPを更新した後、またはIssueをclose/reopenした後に実行してください。

set -euo pipefail

ROADMAP_PATH="docs/ROADMAP.md"
FIX_MODE=false
ERRORS=0
WARNINGS=0
FIXED=0

if [ "${1:-}" = "--fix" ]; then
    FIX_MODE=true
fi

# gh CLI チェック
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI がインストールされていません。"
    exit 1
fi

echo "🔍 ROADMAP ↔ GitHub Issue 整合性チェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ROADMAPからIssue番号を抽出
ISSUE_NUMS=$(grep -oE '\| #[0-9]+' "$ROADMAP_PATH" | grep -oE '[0-9]+' | sort -n | uniq)

if [ -z "$ISSUE_NUMS" ]; then
    echo "❌ ROADMAP.md からIssue番号を抽出できませんでした。"
    exit 1
fi

TOTAL=$(echo "$ISSUE_NUMS" | wc -l | tr -d ' ')
echo "📋 ROADMAP内のIssue数: $TOTAL"
echo ""

# 各Issueを検証
for num in $ISSUE_NUMS; do
    # GitHub からIssue情報を取得
    ISSUE_DATA=$(gh issue view "$num" --json title,state 2>/dev/null || echo "NOT_FOUND")

    if [ "$ISSUE_DATA" = "NOT_FOUND" ]; then
        echo "❌ #$num: GitHub Issue が存在しません"
        ERRORS=$((ERRORS + 1))
        continue
    fi

    GH_TITLE=$(echo "$ISSUE_DATA" | jq -r '.title')
    GH_STATE=$(echo "$ISSUE_DATA" | jq -r '.state')

    # ROADMAPからこのIssueの行を取得
    ROADMAP_LINE=$(grep -E "^\| #$num " "$ROADMAP_PATH" || true)

    if [ -z "$ROADMAP_LINE" ]; then
        echo "⚠️  #$num: ROADMAP に存在しません (GitHub: $GH_TITLE)"
        WARNINGS=$((WARNINGS + 1))
        continue
    fi

    # タイトル検証（ROADMAPのタイトルがGitHubタイトルの先頭部分と一致するか）
    ROADMAP_TITLE=$(echo "$ROADMAP_LINE" | awk -F'|' '{print $3}' | sed 's/^ *//;s/ *$//')

    if [ "$ROADMAP_TITLE" != "$GH_TITLE" ]; then
        # ROADMAPのタイトルがGitHubタイトルに含まれていれば許容（省略表記）
        if echo "$GH_TITLE" | grep -qF "$ROADMAP_TITLE"; then
            : # 省略表記として許容
        elif echo "$ROADMAP_TITLE" | grep -qF "$GH_TITLE"; then
            : # 逆方向の包含も許容
        else
            echo "❌ #$num タイトル不一致:"
            echo "   ROADMAP: $ROADMAP_TITLE"
            echo "   GitHub:  $GH_TITLE"
            ERRORS=$((ERRORS + 1))
        fi
    fi

    # 状態検証
    ROADMAP_STATE=$(echo "$ROADMAP_LINE" | awk -F'|' '{print $4}' | sed 's/^ *//;s/ *$//')
    EXPECTED_STATE=""
    if [ "$GH_STATE" = "CLOSED" ]; then
        EXPECTED_STATE="✅"
    else
        EXPECTED_STATE="🔲"
    fi

    if [ "$ROADMAP_STATE" != "$EXPECTED_STATE" ]; then
        echo "❌ #$num 状態不一致: ROADMAP=$ROADMAP_STATE, GitHub=$GH_STATE (期待: $EXPECTED_STATE)"
        ERRORS=$((ERRORS + 1))

        if [ "$FIX_MODE" = true ]; then
            # 状態を修正（macOS/Linux互換のsed）
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/| #$num |\\(.*\\)| $ROADMAP_STATE |/| #$num |\\1| $EXPECTED_STATE |/" "$ROADMAP_PATH"
            else
                sed -i "s/| #$num |\\(.*\\)| $ROADMAP_STATE |/| #$num |\\1| $EXPECTED_STATE |/" "$ROADMAP_PATH"
            fi
            FIXED=$((FIXED + 1))
            echo "   → 修正しました: $ROADMAP_STATE → $EXPECTED_STATE"
        fi
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 結果:"
echo "   Issue数: $TOTAL"
echo "   エラー: $ERRORS"
echo "   警告: $WARNINGS"
if [ "$FIX_MODE" = true ]; then
    echo "   修正: $FIXED"
fi
echo ""

if [ "$ERRORS" -gt 0 ] && [ "$FIX_MODE" = false ]; then
    echo "💡 状態の不一致を自動修正するには: ./scripts/sync-roadmap.sh --fix"
    echo ""
fi

if [ "$ERRORS" -gt 0 ] && [ "$FIX_MODE" = false ]; then
    exit 1
fi

echo "✅ チェック完了"
exit 0
