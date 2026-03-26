#!/bin/bash
# rebase-on-main.sh
# 現在のブランチをorigin/mainにリベースし、pnpm-lock.yamlコンフリクトを自動解決する
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
    echo "⚠️  mainブランチではリベース不要です。git pull を使ってください。"
    exit 0
fi

BEHIND=$(git -C "$WORKTREE_PATH" rev-list --count "HEAD..origin/main" 2>/dev/null)
if [ "$BEHIND" = "0" ]; then
    echo "✅ $BRANCH は origin/main と同期済みです。"
    exit 0
fi

echo "🔄 $BRANCH を origin/main にリベース中（${BEHIND}コミット遅れ）..."

# リベース実行、コンフリクト発生時にループで自動解決
git -C "$WORKTREE_PATH" rebase origin/main 2>&1 || true

# リベース中のコンフリクト自動解決ループ
MAX_RETRIES=10
RETRY=0

while [ -d "$WORKTREE_PATH/.git/rebase-merge" ] || [ -d "$WORKTREE_PATH/.git/rebase-apply" ] || \
      ([ -f "$WORKTREE_PATH/.git" ] && {
          GIT_DIR=$(cat "$WORKTREE_PATH/.git" | sed 's/^gitdir: //');
          [ -d "$GIT_DIR/rebase-merge" ] || [ -d "$GIT_DIR/rebase-apply" ];
      }); do

    RETRY=$((RETRY + 1))
    if [ "$RETRY" -gt "$MAX_RETRIES" ]; then
        echo "❌ リベース自動解決の上限に達しました。手動で解決してください。"
        echo "   git -C $WORKTREE_PATH rebase --abort  # 中止する場合"
        exit 1
    fi

    # pnpm-lock.yaml のコンフリクトを検出・自動解決
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
        echo "   解決後: git -C $WORKTREE_PATH rebase --continue"
        exit 1
    fi

    # リベース続行
    GIT_EDITOR=true git -C "$WORKTREE_PATH" rebase --continue 2>&1 || true
done

echo "✅ リベース完了: $BRANCH は origin/main の最新です。"
