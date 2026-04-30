#!/bin/bash
# SessionStart hook: 全 worktree の健全性チェック + マージ済み/クローズ済み worktree の自動削除
#
# Pass 1:  マージ済み worktree を自動削除
# Pass 1b: クローズ済み (マージなし) PR の worktree を自動削除（gh 認証時のみ）
# Pass 2:  残りの worktree を健全性チェック（ネスト/不正パス/rebase中/未コミット/遅れ/PR未作成/古い）

PROBLEMS=""
PROBLEM_COUNT=0

remove_worktree_safely() {
  git worktree remove "$1" 2>/dev/null || git worktree remove --force "$1" 2>/dev/null
}

add_problem() {
  PROBLEMS="${PROBLEMS}$1 | "
  PROBLEM_COUNT=$((PROBLEM_COUNT + 1))
}

# 全 worktree（main 以外）を取得
list_worktrees() {
  git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/^worktree //' | tail -n +2
}

WORKTREE_PATHS=$(list_worktrees)
[ -z "$WORKTREE_PATHS" ] && exit 0

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd -P)
WORKTREE_BASE=$(dirname "$REPO_ROOT")
EXPECTED_PREFIX="${WORKTREE_BASE}/"

git fetch origin main --quiet 2>/dev/null || true

if git rev-parse --verify main >/dev/null 2>&1; then
  MAIN_REF="main"
elif git rev-parse --verify origin/main >/dev/null 2>&1; then
  MAIN_REF="origin/main"
else
  MAIN_REF="HEAD"
fi

# 共通: ブランチ名バリデーション
is_safe_branch() {
  [[ "$1" =~ ^[a-zA-Z0-9/_.-]+$ ]]
}

# 共通: dirty チェック (untracked 除く)
is_dirty() {
  git -C "$1" status --porcelain 2>/dev/null | grep -v '^??' | head -1 | grep -q .
}

# Pass 1: マージ済み worktree 削除
REMOVED_COUNT=0
REMOVED_NAMES=""
while IFS= read -r wt; do
  [ -z "$wt" ] || [ ! -d "$wt" ] && continue
  resolved=$(cd "$wt" && pwd -P)
  [[ "$resolved" != "${EXPECTED_PREFIX}"* ]] && continue
  [[ "$resolved" == "${REPO_ROOT}"* ]] && continue

  head=$(git -C "$wt" rev-parse HEAD 2>/dev/null) || continue
  git -C "$REPO_ROOT" merge-base --is-ancestor "$head" "$MAIN_REF" 2>/dev/null || continue

  branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null)
  is_safe_branch "$branch" || continue
  git -C "$REPO_ROOT" reflog "refs/heads/$branch" --format='%gs' 2>/dev/null | grep -q '^commit:' || continue
  is_dirty "$wt" && continue

  name=$(basename "$wt")
  remove_worktree_safely "$wt" || continue
  [ -n "$branch" ] && [ "$branch" != "HEAD" ] && git branch -D "$branch" 2>/dev/null || true
  REMOVED_COUNT=$((REMOVED_COUNT + 1))
  REMOVED_NAMES="${REMOVED_NAMES:+${REMOVED_NAMES}, }${name}"
done <<< "$WORKTREE_PATHS"

# gh 認証確認 (Pass 1b / Pass 2 で共用)
REPO_SLUG=""
if command -v gh >/dev/null 2>&1 && gh auth token >/dev/null 2>&1; then
  REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")
fi

# Pass 1b: クローズ済み (マージなし) PR の worktree 削除
if [ -n "$REPO_SLUG" ]; then
  while IFS= read -r wt; do
    [ -z "$wt" ] || [ ! -d "$wt" ] && continue
    resolved=$(cd "$wt" && pwd -P)
    [[ "$resolved" != "${EXPECTED_PREFIX}"* ]] && continue
    [[ "$resolved" == "${REPO_ROOT}"* ]] && continue

    branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null)
    [ -z "$branch" ] || [ "$branch" = "HEAD" ] && continue
    is_safe_branch "$branch" || continue

    state=$(gh pr list --repo "$REPO_SLUG" --head "$branch" --state closed --json state,mergedAt --jq '.[0]|select(.mergedAt==null)|.state' 2>/dev/null)
    [ "$state" = "CLOSED" ] || continue

    name=$(basename "$wt")
    if is_dirty "$wt"; then
      add_problem "[クローズ済みPR] ${name}: 未コミット変更あり -> 確認後 git worktree remove ${wt}"
      continue
    fi
    remove_worktree_safely "$wt" || continue
    git branch -D "$branch" 2>/dev/null || true
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
    REMOVED_NAMES="${REMOVED_NAMES:+${REMOVED_NAMES}, }${name}(closed)"
  done <<< "$(list_worktrees)"
fi

# Pass 2: 残った worktree の健全性チェック
while IFS= read -r wt; do
  [ -z "$wt" ] || [ ! -d "$wt" ] && continue
  resolved=$(cd "$wt" && pwd -P)
  name=$(basename "$wt")

  # ネスト worktree
  if [[ "$resolved" == "${REPO_ROOT}/"* ]]; then
    add_problem "[ネスト] ${name}: REPO_ROOT 内部 -> remove --force して ${WORKTREE_BASE}/ 直下に再作成"
    continue
  fi

  # 不正パス
  if [[ "$resolved" != "${EXPECTED_PREFIX}"* ]]; then
    add_problem "[不正パス] ${name}: ${WORKTREE_BASE}/ 直下にない -> 正しいパスに再作成"
    continue
  fi

  # サブディレクトリにネスト
  local_path="${resolved#${EXPECTED_PREFIX}}"
  if [[ "$local_path" == */* ]]; then
    add_problem "[ネスト] ${name}: ${WORKTREE_BASE}/ の直下ではない -> 直下に再作成"
    continue
  fi

  # rebase / merge 途中
  if [ -f "$wt/.git" ]; then
    GIT_DIR=$(sed 's/^gitdir: //' "$wt/.git")
    case "$GIT_DIR" in *".."*) GIT_DIR="" ;; esac
    [ -n "$GIT_DIR" ] && [[ "$GIT_DIR" != /* ]] && GIT_DIR="$wt/$GIT_DIR"
  elif [ -d "$wt/.git" ]; then
    GIT_DIR="$wt/.git"
  else
    GIT_DIR=""
  fi

  if [ -n "$GIT_DIR" ]; then
    if [ -d "$GIT_DIR/rebase-merge" ] || [ -d "$GIT_DIR/rebase-apply" ]; then
      add_problem "[リベース中] ${name}: rebase --continue または --abort"
      continue
    fi
    if [ -f "$GIT_DIR/MERGE_HEAD" ]; then
      add_problem "[マージ中] ${name}: merge --continue または --abort"
      continue
    fi
  fi

  # 未コミット変更
  DIRTY_LINES=$(git -C "$wt" status --porcelain 2>/dev/null | grep -v '^??')
  if [ -n "$DIRTY_LINES" ]; then
    DIRTY_COUNT=$(echo "$DIRTY_LINES" | wc -l | tr -d ' ')
    add_problem "[未コミット] ${name}: ${DIRTY_COUNT}件 -> git -C ${wt} add -A && git commit"
  fi

  # main から遅れ
  BEHIND=$(git -C "$wt" rev-list --count "HEAD..${MAIN_REF}" 2>/dev/null)
  if [ -n "$BEHIND" ] && [ "$BEHIND" -gt 0 ]; then
    add_problem "[遅れ] ${name}: ${BEHIND} commits behind -> git -C ${wt} merge ${MAIN_REF}"
  fi

  # PR 未作成 + 変更なし
  branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -n "$REPO_SLUG" ] && is_safe_branch "$branch" && [ "$branch" != "HEAD" ]; then
    PR_COUNT=$(gh pr list --repo "$REPO_SLUG" --head "$branch" --state all --json number --jq 'length' 2>/dev/null || echo 0)
    if [ "$PR_COUNT" = "0" ] && [ -z "$DIRTY_LINES" ]; then
      add_problem "[PR未作成] ${name}: PR/変更なし -> 不要なら git worktree remove ${wt}"
    fi
  fi

  # 14 日以上未更新
  LAST=$(git -C "$wt" log -1 --format="%ct" 2>/dev/null)
  if [ -n "$LAST" ]; then
    AGE=$(( ( $(date +%s) - LAST ) / 86400 ))
    [ "$AGE" -ge 14 ] && add_problem "[古い] ${name}: ${AGE}日前 -> 不要なら git worktree remove ${wt}"
  fi
done <<< "$(list_worktrees)"

# 出力
SUMMARY=""
[ "$REMOVED_COUNT" -gt 0 ] && SUMMARY="${REMOVED_COUNT}件自動削除: ${REMOVED_NAMES} | "
[ "$PROBLEM_COUNT" -gt 0 ] && SUMMARY="${SUMMARY}Worktree health: ${PROBLEM_COUNT} issues. ${PROBLEMS}"

if [ -n "$SUMMARY" ]; then
  if command -v jq &>/dev/null; then
    jq -n --arg msg "$SUMMARY" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}'
  else
    SAFE=$(printf '%s' "$SUMMARY" | tr -d '"\\\n\r\t')
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$SAFE"
  fi
fi

exit 0
