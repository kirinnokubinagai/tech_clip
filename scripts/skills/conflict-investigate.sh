#!/usr/bin/env bash
# conflict-investigate.sh: analyst が CONFLICT_INVESTIGATE 受信時に呼ぶ調査スクリプト
#
# origin/main との conflict を 1 コマンドで調査し、両側の意図を構造化して出力する。
# analyst はこの出力を読んで両立解消方針 spec を作成する。
#
# 使い方:
#   bash scripts/skills/conflict-investigate.sh [worktree-path]
#
# 出力形式 (Markdown):
#   ## Conflict Investigation: <branch> vs origin/main
#
#   ### Conflict files (N 個)
#   - path/to/file.ts
#   ...
#
#   ### HEAD side commits (自分側)
#   abc123 feat: ...
#   ...
#
#   ### origin/main side commits (main 側)
#   def456 fix: ...
#   ...
#
#   ### Per-file diff summary
#   #### path/to/file.ts
#   - HEAD touches: abc123 (feat: add ...)
#   - main touches: def456 (fix: refactor ...)
#   ...

set -euo pipefail

WORKTREE="${1:-$(pwd)}"
cd "$WORKTREE"

git fetch origin main --quiet 2>/dev/null || true

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")
echo "## Conflict Investigation: ${BRANCH} vs origin/main"
echo

# conflict files の検出: dry-run merge で UU ファイルを取得
git merge --no-commit --no-ff origin/main >/dev/null 2>&1 || true
CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null)
git merge --abort 2>/dev/null || true

if [ -z "$CONFLICT_FILES" ]; then
  # 既に解消されているか、conflict が発生しなかった
  echo "### 結果: conflict なし"
  echo
  echo "origin/main を取り込んでも conflict は発生しません。BEHIND の場合は reviewer が自動 merge します。"
  exit 0
fi

FILE_COUNT=$(echo "$CONFLICT_FILES" | wc -l | tr -d ' ')
echo "### Conflict files (${FILE_COUNT} 個)"
echo "$CONFLICT_FILES" | sed 's/^/- /'
echo

# HEAD 側 commits (自分の branch でだけ存在)
echo "### HEAD side commits（自分側）"
HEAD_COMMITS=$(git log --oneline HEAD ^origin/main 2>/dev/null | head -20)
if [ -z "$HEAD_COMMITS" ]; then
  echo "(なし — HEAD は origin/main の祖先)"
else
  echo "$HEAD_COMMITS"
fi
echo

# main 側 commits (origin/main にだけ存在)
echo "### origin/main side commits（main 側）"
MAIN_COMMITS=$(git log --oneline origin/main ^HEAD 2>/dev/null | head -20)
if [ -z "$MAIN_COMMITS" ]; then
  echo "(なし — origin/main は HEAD の祖先)"
else
  echo "$MAIN_COMMITS"
fi
echo

# Per-file diff summary
echo "### Per-file 変更履歴"
while IFS= read -r file; do
  [ -z "$file" ] && continue
  echo
  echo "#### \`${file}\`"
  echo
  echo "**HEAD 側で触ったコミット**:"
  HEAD_TOUCH=$(git log --oneline HEAD ^origin/main -- "$file" 2>/dev/null | head -10)
  if [ -z "$HEAD_TOUCH" ]; then
    echo "(なし)"
  else
    echo '```'
    echo "$HEAD_TOUCH"
    echo '```'
  fi

  echo
  echo "**origin/main 側で触ったコミット**:"
  MAIN_TOUCH=$(git log --oneline origin/main ^HEAD -- "$file" 2>/dev/null | head -10)
  if [ -z "$MAIN_TOUCH" ]; then
    echo "(なし)"
  else
    echo '```'
    echo "$MAIN_TOUCH"
    echo '```'
  fi

  echo
  echo "**HEAD vs origin/main の差分**:"
  echo '```diff'
  git diff origin/main HEAD -- "$file" 2>/dev/null | head -100
  echo '```'
done <<< "$CONFLICT_FILES"

echo
echo "---"
echo "次のアクション: 両側の意図を統合した spec を /tmp/issue-{N}-conflict-spec.md に作成し、coder-{N} に CONFLICT_RESOLVE を送信。片側採用は原則禁止。"
