#!/bin/bash
# merge-from-main.sh (旧 rebase-on-main.sh)
# 現在のブランチにorigin/mainをマージし、pnpm-lock.yamlコンフリクトを自動解決する
# rebaseではなくmergeを使用するため、force pushが不要
#
# 使い方:
#   scripts/rebase-on-main.sh                    # カレントディレクトリで実行
#   scripts/rebase-on-main.sh /path/to/worktree  # 指定worktreeで実行

set -euo pipefail

WORKTREE_PATH="${1:-.}"

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "❌ ディレクトリが見つかりません: $WORKTREE_PATH"
    exit 1
fi

echo "📥 origin/main を fetch..."
git -C "$WORKTREE_PATH" fetch origin main --quiet 2>/dev/null

BRANCH=$(git -C "$WORKTREE_PATH" branch --show-current 2>/dev/null)
if [ "$BRANCH" = "main" ]; then
    echo "⚠️  mainブランチではmerge不要です。git pull を使ってください。"
    exit 0
fi

BEHIND=$(git -C "$WORKTREE_PATH" rev-list --count "HEAD..origin/main" 2>/dev/null)
if [ "$BEHIND" = "0" ]; then
    echo "✅ $BRANCH は origin/main と同期済みです。"
    exit 0
fi

echo "🔄 $BRANCH に origin/main をマージ中（${BEHIND}コミット遅れ）..."

# マージ実行
if git -C "$WORKTREE_PATH" merge origin/main --no-edit 2>&1; then
    echo "✅ マージ完了: $BRANCH は origin/main の最新です。"
    exit 0
fi

# コンフリクト発生時の自動解決
CONFLICTS=$(git -C "$WORKTREE_PATH" diff --name-only --diff-filter=U 2>/dev/null)

if echo "$CONFLICTS" | grep -q "pnpm-lock.yaml"; then
    echo "  🔧 pnpm-lock.yaml コンフリクトを自動解決中..."
    git -C "$WORKTREE_PATH" checkout --theirs pnpm-lock.yaml
    (cd "$WORKTREE_PATH" && pnpm install --no-frozen-lockfile 2>/dev/null) || true
    git -C "$WORKTREE_PATH" add pnpm-lock.yaml
fi

# pnpm-lock.yaml以外のコンフリクトがあるか確認
REMAINING=$(git -C "$WORKTREE_PATH" diff --name-only --diff-filter=U 2>/dev/null | grep -v "pnpm-lock.yaml" || true)
if [ -n "$REMAINING" ]; then
    echo "❌ 手動解決が必要なコンフリクトがあります:"
    echo "$REMAINING"
    echo "   解決後: git -C $WORKTREE_PATH add . && git -C $WORKTREE_PATH merge --continue"
    exit 1
fi

# マージコミット完了
git -C "$WORKTREE_PATH" commit --no-edit 2>/dev/null || true
echo "✅ マージ完了: $BRANCH は origin/main の最新です。"
