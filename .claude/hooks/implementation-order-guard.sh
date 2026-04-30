#!/bin/bash
# Implementation Order Guard
# Issue依存関係をチェックし、依存Issueが未完了の場合に警告する
#
# 依存関係は docs/ROADMAP.md と一致させること。
# 更新時は scripts/sync-roadmap.sh で検証すること。

# 引数からIssue番号を抽出（ブランチ名から）
BRANCH=$(git branch --show-current 2>/dev/null)
ISSUE_NUM=$(echo "$BRANCH" | grep -oE 'issue/([0-9]+)' | grep -oE '[0-9]+')

if [ -z "$ISSUE_NUM" ]; then
    exit 0  # Issue番号がない場合はスキップ
fi

# 依存関係マップ（Phase別）
# ⚠️ docs/ROADMAP.md の依存列と一致させること

# Phase 0: セットアップ
PHASE0_DEPS="36:17 19:17 18:17 109:17 23:17 112:17,36 20:18 22:18 24:18 25:18,20"

# Phase 1: DB + 認証
PHASE1_DEPS="27:19 26:27 29:27 28:26 30:29 31:29 32:26 33:26 34:26,29 37:26,28 35:37 38:37 41:38 39:41 40:41"

# Phase 2: パーサー
PHASE2_DEPS="42:29 43:42 44:43 45:43 46:43 47:43 48:43 50:43 51:43 52:43 53:43 54:43 55:43 56:43 60:43 61:43 57:42 148:43"

# Phase 3: API
PHASE3_DEPS="123:19 124:19 58:29,38 59:29,38 62:58 63:30,62 64:30,62 65:31,62 66:59 67:26,38 68:67,133 69:33,38 70:67,59 71:32,38 72:71 73:26,38 107:26,63 116:38,155 125:38 146:58"

# Phase 4: モバイル
PHASE4_DEPS="138:18 137:18 113:18,20 134:25 136:25 115:25 76:25 77:76 75:113,76,59 74:113,58 78:76,62 79:113,66 80:65 81:113,67 82:81,68 83:81,69 84:113 85:113,71 108:76 152:25 158:152"

# Phase 5: 課金
PHASE5_DEPS="89:73 90:18 91:89 144:89 161:107"

# Phase 6: ソーシャル・通知
PHASE6_DEPS="86:71 145:86,85 114:83"

# Phase 7: オフライン
PHASE7_DEPS="87:78 88:87 156:87"

# Phase 8: テスト
PHASE8_DEPS="143:34"

# Phase 9: リリース準備
PHASE9_DEPS="92:18 93:74 94:18 95:18 120:26,38 121:18 122:121 129:18,19 130:19 131:18 132:19 133:19 135:113 142:95 147:19 150:27 151:111 153:95 154:18 155:19 157:37,84 160:95,112 163:34"

ALL_DEPS="$PHASE0_DEPS $PHASE1_DEPS $PHASE2_DEPS $PHASE3_DEPS $PHASE4_DEPS $PHASE5_DEPS $PHASE6_DEPS $PHASE7_DEPS $PHASE8_DEPS $PHASE9_DEPS"

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
fi

exit 0
