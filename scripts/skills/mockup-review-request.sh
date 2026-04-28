#!/usr/bin/env bash
# mockup-review-request.sh: ui-designer がモックアップ承認リクエストを送る前に呼ぶスクリプト
#
# 1. 直近のモックアップファイル（docs/design/, apps/mobile/assets/ 配下の画像/spec）を検出
# 2. orchestrator (team-lead) に送る MOCKUP_REVIEW_REQUEST メッセージを構築
# 3. メッセージ本文を stdout に出力
#
# 使い方:
#   bash scripts/skills/mockup-review-request.sh <issue-number> [worktree-path]
#
# 出力例（このまま SendMessage の message として使える）:
#   MOCKUP_REVIEW_REQUEST: issue=1234 commit=abc123def
#   モックアップ確認をお願いします:
#   - docs/design/issue-1234-home-mockup.png
#   - docs/design/issue-1234-detail-mockup.png
#   実機 / シミュレータ確認後、承認 (MOCKUP_APPROVED:) を返してください。

set -euo pipefail

ISSUE_NUM="${1:?usage: mockup-review-request.sh <issue-number> [worktree]}"
WORKTREE="${2:-$(pwd)}"
cd "$WORKTREE"

COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")

# 直近 7 日以内に変更された design 関連ファイルを抽出
SEARCH_PATHS=(docs/design apps/mobile/assets apps/mobile/src)
DESIGN_FILES=""
for p in "${SEARCH_PATHS[@]}"; do
  [ -d "$p" ] || continue
  found=$(find "$p" -type f \( -name '*.png' -o -name '*.svg' -o -name '*.webp' -o -name '*-mockup*' -o -name '*-design*' \) -mtime -7 2>/dev/null || true)
  [ -n "$found" ] && DESIGN_FILES+="${DESIGN_FILES:+$'\n'}${found}"
done

# 最新 5 件に絞る（多すぎると review が大変）
if [ -n "$DESIGN_FILES" ]; then
  DESIGN_FILES=$(echo "$DESIGN_FILES" | head -5)
fi

# メッセージ構築
echo "MOCKUP_REVIEW_REQUEST: issue=${ISSUE_NUM} commit=${COMMIT_HASH}"
echo "branch: ${BRANCH}"
echo
echo "モックアップ確認をお願いします。"
if [ -n "$DESIGN_FILES" ]; then
  echo
  echo "## 確認対象ファイル"
  echo "$DESIGN_FILES" | sed 's/^/- /'
fi
echo
echo "## 確認方法"
echo "1. 上記のモックアップ画像を Read で表示"
echo "2. 必要に応じて実機 / Android emulator で確認"
echo "3. 問題なければ \`MOCKUP_APPROVED: issue-${ISSUE_NUM}\` を返信、または"
echo "   \`bash scripts/skills/mockup-approve.sh ${ISSUE_NUM}\` を実行してフラグを書き込む"
echo "4. 修正が必要なら CHANGES_REQUESTED で指示を返す"
