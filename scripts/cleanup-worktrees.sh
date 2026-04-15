#!/bin/bash
# cleanup-worktrees.sh
# インタラクティブに古い worktree を削除する
#
# 使い方:
#   bash scripts/cleanup-worktrees.sh            # 対話モード
#   bash scripts/cleanup-worktrees.sh --dry-run  # 削除候補一覧のみ（副作用なし）
#   bash scripts/cleanup-worktrees.sh --yes      # 全削除候補を確認なしで削除
#   bash scripts/cleanup-worktrees.sh --no-size  # サイズ計算を省略（高速化）

set -euo pipefail

DRY_RUN=0
YES=0
NO_SIZE=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes)     YES=1 ;;
        --no-size) NO_SIZE=1 ;;
    esac
done

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

REPO_SLUG=""
if command -v gh >/dev/null 2>&1 && gh auth token >/dev/null 2>&1; then
    REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")
fi

DELETED_COUNT=0
QUIT=0

while IFS= read -r wt_path; do
    [ "$QUIT" -eq 1 ] && break
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
    LAST_COMMIT_TS=$(git -C "$wt_path" log -1 --format="%ct" 2>/dev/null || echo "0")
    NOW_TS=$(date +%s)
    AGE_DAYS=$(( (NOW_TS - LAST_COMMIT_TS) / 86400 ))

    # カテゴリ判定（merged/closed/orphan/stale）
    CATEGORY=""
    wt_head=$(git -C "$wt_path" rev-parse HEAD 2>/dev/null || echo "")
    if [ -n "$wt_head" ] && git -C "$REPO_ROOT" merge-base --is-ancestor "$wt_head" "$MAIN_REF" 2>/dev/null; then
        CATEGORY="merged"
    elif [ -n "$REPO_SLUG" ] && [ -n "$branch" ] && [ "$branch" != "HEAD" ] && [ "$branch" != "detached" ]; then
        pr_json=$(gh pr list --repo "$REPO_SLUG" --head "$branch" --state all --json state,mergedAt --jq '.' 2>/dev/null || echo "[]")
        pr_count=$(echo "$pr_json" | jq 'length' 2>/dev/null || echo "0")
        pr_state=$(echo "$pr_json" | jq -r '.[] | select(.state == "CLOSED" and .mergedAt == null) | .state' 2>/dev/null | head -1)
        if [ "$pr_state" = "CLOSED" ]; then
            CATEGORY="closed"
        elif [ "$pr_count" = "0" ] && [ "$AGE_DAYS" -ge 14 ]; then
            CATEGORY="orphan"
        elif [ "$AGE_DAYS" -ge 14 ]; then
            CATEGORY="stale"
        fi
    elif [ "$AGE_DAYS" -ge 14 ]; then
        CATEGORY="stale"
    fi

    [ -z "$CATEGORY" ] && continue

    # サイズ取得（--no-size で省略可）
    SIZE_STR=""
    if [ "$NO_SIZE" -eq 0 ]; then
        SIZE_STR=$(du -sh "$wt_path" 2>/dev/null | cut -f1 || echo "不明")
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  worktree  : ${wt_name}  [${CATEGORY}]"
    echo "  パス      : ${wt_path}"
    echo "  ブランチ  : ${branch}"
    echo "  最終commit: ${LAST_COMMIT}（${AGE_DAYS}日前）"
    echo "  main との差: ${BEHIND} commits behind"
    [ -n "$SIZE_STR" ] && echo "  ディスク  : ${SIZE_STR}"
    if [ -n "$DIRTY" ]; then
        echo "  状態      : 未コミットの変更あり"
    else
        echo "  状態      : クリーン"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ "$DRY_RUN" -eq 1 ]; then
        echo "  [dry-run] 削除対象"
        continue
    fi

    if [ -n "$DIRTY" ]; then
        echo "  -> 未コミットの変更があるためスキップします（削除するには先にコミットまたはスタッシュしてください）"
        continue
    fi

    if [ "$YES" -eq 1 ]; then
        ANSWER="y"
    else
        printf "  削除しますか？ [y/N/a(全削除)/q(終了)] "
        read -r ANSWER
    fi

    case "$ANSWER" in
        a|A)
            YES=1
            ANSWER="y"
            ;;
        q|Q)
            QUIT=1
            echo "  -> 終了します"
            continue
            ;;
    esac

    case "$ANSWER" in
        y|Y)
            if git worktree remove "$wt_path" 2>/dev/null; then
                echo "  -> 削除しました"
            elif git worktree remove --force "$wt_path" 2>/dev/null; then
                echo "  -> 強制削除しました"
            else
                # fallback: prune してリトライ
                git worktree prune 2>/dev/null || true
                if git worktree remove --force "$wt_path" 2>/dev/null; then
                    echo "  -> prune 後に削除しました"
                else
                    echo "  -> 削除失敗。手動で削除してください: git worktree remove --force ${wt_path}"
                    continue
                fi
            fi
            if [ -n "$branch" ] && [ "$branch" != "HEAD" ] && [ "$branch" != "detached" ]; then
                git branch -D "$branch" 2>/dev/null || true
            fi
            DELETED_COUNT=$((DELETED_COUNT + 1))
            ;;
        *)
            echo "  -> スキップしました"
            ;;
    esac
done <<< "$WORKTREE_PATHS"

echo ""
if [ "$DRY_RUN" -eq 1 ]; then
    echo "完了: --dry-run モード。実際の削除は行いませんでした。"
else
    echo "完了: ${DELETED_COUNT}件の worktree を削除しました。"
fi
