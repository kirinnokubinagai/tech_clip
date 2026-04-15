#!/bin/bash
# cleanup-worktrees.sh
# インタラクティブに古い worktree を削除するスクリプト
#
# 使用方法:
#   bash scripts/cleanup-worktrees.sh
#
# 動作:
# - 全 worktree を一覧表示し、状態を表示する
# - 各 worktree に対してインタラクティブに削除確認する
# - --all フラグで全 worktree を一括削除（CI 用）

set -euo pipefail

ALL_MODE=false
if [ "${1:-}" = "--all" ]; then
    ALL_MODE=true
fi

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd -P)
WORKTREE_BASE=$(dirname "$REPO_ROOT")
EXPECTED_PREFIX="${WORKTREE_BASE}/"

WORKTREE_PATHS=$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2)

if [ -z "$WORKTREE_PATHS" ]; then
    echo "クリーンアップ対象の worktree はありません。"
    exit 0
fi

git fetch origin main --quiet 2>/dev/null || true

MAIN_REF=""
if git rev-parse --verify main >/dev/null 2>&1; then
    MAIN_REF="main"
elif git rev-parse --verify origin/main >/dev/null 2>&1; then
    MAIN_REF="origin/main"
else
    MAIN_REF="HEAD"
fi

DELETED_COUNT=0

while IFS= read -r wt_path; do
    [ -z "$wt_path" ] && continue
    [ -d "$wt_path" ] || continue

    resolved_wt_path=$(cd "$wt_path" && pwd -P)
    [[ "$resolved_wt_path" != "${EXPECTED_PREFIX}"* ]] && continue
    [[ "$resolved_wt_path" == "${REPO_ROOT}" || "$resolved_wt_path" == "${REPO_ROOT}/"* ]] && continue

    wt_name=$(basename "$wt_path")
    branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")

    DIRTY=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v '^??' | head -1)
    BEHIND=$(git -C "$wt_path" rev-list --count "HEAD..${MAIN_REF}" 2>/dev/null || echo "0")
    LAST_COMMIT=$(git -C "$wt_path" log -1 --format="%cr" 2>/dev/null || echo "不明")

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  worktree : ${wt_name}"
    echo "  パス     : ${wt_path}"
    echo "  ブランチ : ${branch}"
    echo "  最終commit: ${LAST_COMMIT}"
    echo "  main との差: ${BEHIND} commits behind"
    if [ -n "$DIRTY" ]; then
        echo "  状態     : 未コミットの変更あり"
    else
        echo "  状態     : クリーン"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ -n "$DIRTY" ] && ! $ALL_MODE; then
        echo "  -> 未コミットの変更があるためスキップします（--all でも強制削除可能）"
        continue
    fi

    if $ALL_MODE; then
        ANSWER="y"
    else
        printf "  削除しますか？ [y/N] "
        read -r ANSWER
    fi

    case "$ANSWER" in
        y|Y)
            git worktree remove "$wt_path" 2>/dev/null || git worktree remove --force "$wt_path" 2>/dev/null || {
                echo "  -> 削除失敗。手動で削除してください: git worktree remove --force ${wt_path}"
                continue
            }
            if [ -n "$branch" ] && [ "$branch" != "HEAD" ] && [ "$branch" != "detached" ]; then
                git branch -D "$branch" 2>/dev/null || true
            fi
            echo "  -> 削除しました"
            DELETED_COUNT=$((DELETED_COUNT + 1))
            ;;
        *)
            echo "  -> スキップしました"
            ;;
    esac
done <<< "$WORKTREE_PATHS"

echo ""
echo "完了: ${DELETED_COUNT}件の worktree を削除しました。"
