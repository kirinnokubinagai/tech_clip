#!/bin/bash
# Implementation Order Guard
# Issue依存関係をチェックし、依存Issueが未完了の場合に警告する

# 引数からIssue番号を抽出（ブランチ名から）
BRANCH=$(git branch --show-current 2>/dev/null)
ISSUE_NUM=$(echo "$BRANCH" | grep -oE 'issue/([0-9]+)' | grep -oE '[0-9]+')

if [ -z "$ISSUE_NUM" ]; then
    exit 0  # Issue番号がない場合はスキップ
fi

# 依存関係マップ（Phase別）
# Phase 1: DB + 認証 - #36に依存
PHASE1_DEPS="26:36 27:36 28:26,27 29:26,27 30:36 31:26,30 32:27 33:27 34:36 35:34 37:26 38:37 39:37 40:37 41:37"

# Phase 2: パーサー - #27に依存
PHASE2_DEPS="42:27 43:42 44:42 45:42 46:42 47:42 48:42 50:42 51:42 52:42 53:42 54:42 55:42 56:42 57:42 60:43,44,45,46,47,48,50,51,52,53,54,55,56,57 61:60"

# Phase 3: API - 認証とパーサーに依存
PHASE3_DEPS="58:38 59:58 62:27,60 63:62 64:28 65:29 66:31 67:32 68:33 69:62 70:62,66 71:59 72:64,65 73:58"

# Phase 4: モバイル - APIに依存
PHASE4_DEPS="74:49 75:74,70 76:74,63 77:74,64 78:74,69 79:74,59 80:79,66 81:74,58 82:81 83:79,59 84:76,67 85:76,68 86:75,76,77,78 113:75 114:75 115:75"

ALL_DEPS="$PHASE1_DEPS $PHASE2_DEPS $PHASE3_DEPS $PHASE4_DEPS"

# 現在のIssueの依存を取得
DEPS=""
for item in $ALL_DEPS; do
    issue=$(echo "$item" | cut -d: -f1)
    if [ "$issue" = "$ISSUE_NUM" ]; then
        DEPS=$(echo "$item" | cut -d: -f2)
        break
    fi
done

if [ -z "$DEPS" ]; then
    exit 0  # 依存関係が定義されていない場合はスキップ
fi

# 依存Issueの状態をチェック（GitHub CLI使用）
if ! command -v gh &> /dev/null; then
    echo "⚠️  gh CLI がインストールされていません。依存関係チェックをスキップします。"
    exit 0
fi

IFS=',' read -ra DEP_ARRAY <<< "$DEPS"
INCOMPLETE_DEPS=""

for dep in "${DEP_ARRAY[@]}"; do
    STATE=$(gh issue view "$dep" --json state -q '.state' 2>/dev/null)
    if [ "$STATE" != "CLOSED" ]; then
        INCOMPLETE_DEPS="$INCOMPLETE_DEPS #$dep"
    fi
done

if [ -n "$INCOMPLETE_DEPS" ]; then
    echo ""
    echo "⚠️  実装順序警告"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Issue #$ISSUE_NUM には未完了の依存Issueがあります:"
    echo "  未完了:$INCOMPLETE_DEPS"
    echo ""
    echo "依存Issueを先に完了させることを推奨します。"
    echo "詳細: docs/ROADMAP.md"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    # 警告のみで続行を許可（exit 0）
    # 強制ブロックにする場合は exit 2 に変更
fi

exit 0
