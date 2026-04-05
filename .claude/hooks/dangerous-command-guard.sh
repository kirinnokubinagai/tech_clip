#!/bin/bash
# 危険なコマンドを検知して確認を促すhook
# $ARGUMENTS 環境変数からBashコマンドを取得

# jqがない場合はスキップ
if ! command -v jq &> /dev/null; then
  exit 0
fi

# $ARGUMENTSからcommandフィールドを抽出
COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# worktreeパスの検証（.worktrees/ 配下かつ直下のディレクトリか）
check_worktree_path() {
  local cmd="$1"

  if ! echo "$cmd" | grep -qE "git worktree add "; then
    return 1
  fi

  local wt_path resolved_path repo_root expected_prefix
  # -b フラグとそのブランチ名をスキップしてパスを抽出
  wt_path=$(echo "$cmd" | sed 's/.*git worktree add //' | sed 's/-b [^ ]* //' | awk '{print $1}')
  repo_root=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd)
  expected_prefix="${repo_root}/.worktrees/"

  # realpath -m でシンボリックリンクや .. を正規化（存在しないパスでも動作）
  resolved_path=$(realpath -m "$wt_path" 2>/dev/null || echo "$(pwd)/$wt_path")

  if [[ "$resolved_path" != "${expected_prefix}"* ]]; then
    echo "⚠️ worktreeの作成先が ${expected_prefix} 配下ではありません"
    echo "  指定パス: $wt_path"
    echo "  解決先:   $resolved_path"
    echo "  正しい例: ${expected_prefix}issue-N"
    return 0
  fi

  local subpath="${resolved_path#${expected_prefix}}"
  if [[ "$subpath" == */* ]]; then
    echo "⚠️ worktreeが .worktrees/ の直下ではなくネストしています"
    echo "  解決先: $resolved_path"
    echo "  正しい例: ${expected_prefix}issue-N"
    return 0
  fi

  return 1
}

# 危険なコマンドパターン
check_dangerous() {
  local cmd="$1"

  # rm コマンド
  echo "$cmd" | grep -qE "^rm " && return 0

  # git 破壊的コマンド
  echo "$cmd" | grep -qE "git reset --hard" && return 0
  echo "$cmd" | grep -qE "git push.*--force" && return 0
  echo "$cmd" | grep -qE "git push.*-f[ $]" && return 0
  echo "$cmd" | grep -qE "git checkout -- " && return 0
  echo "$cmd" | grep -qE "git clean" && return 0
  echo "$cmd" | grep -qE "git branch -D" && return 0

  # git worktree add のパス検証（関数に委譲）
  if check_worktree_path "$cmd"; then
    return 0
  fi

  # システムコマンド
  echo "$cmd" | grep -qE "^kill " && return 0
  echo "$cmd" | grep -qE "^killall " && return 0
  echo "$cmd" | grep -qE "chmod 777" && return 0
  echo "$cmd" | grep -qE "^sudo " && return 0

  return 1
}

# PRマージ前のレビューチェック
check_merge_without_review() {
  local cmd="$1"

  # gh pr merge コマンドを検出
  if ! echo "$cmd" | grep -qE "gh pr merge"; then
    return 1
  fi

  # PR番号を抽出
  local pr_num=$(echo "$cmd" | grep -oE "gh pr merge [0-9]+" | grep -oE "[0-9]+")
  if [ -z "$pr_num" ]; then
    return 1
  fi

  # gh CLIが使えない場合はスキップ
  if ! command -v gh &> /dev/null; then
    return 1
  fi

  # PRにレビューコメントがあるか確認
  local repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)
  if [ -z "$repo" ]; then
    return 1
  fi
  local review_count=$(gh api "repos/$repo/pulls/$pr_num/reviews" --jq 'length' 2>/dev/null)
  if [ -z "$review_count" ] || [ "$review_count" = "0" ]; then
    echo "⚠️ レビューなしでPRをマージしようとしています"
    echo "PR #$pr_num にレビューコメントがありません。"
    echo ""
    echo "CLAUDE.mdルール: 全PRはレビュー必須（セルフマージ禁止）"
    echo "先にレビューしてください: gh pr review $pr_num --comment --body 'LGTM'"
    return 0
  fi

  return 1
}

if check_dangerous "$COMMAND"; then
  echo "⚠️ 危険なコマンドを検知しました"
  echo "コマンド: $COMMAND"
  echo ""
  echo "このコマンドは破壊的な操作を行う可能性があります。"
  exit 2
fi

if check_merge_without_review "$COMMAND"; then
  exit 2
fi

# PR作成前のテスト通過チェック
if echo "$COMMAND" | grep -qE "gh pr create"; then
  echo "🧪 PR作成前にテスト通過を確認中..."
  if ! pnpm test 2>/dev/null; then
    echo "❌ テストが失敗しています。テストを修正してからPRを作成してください。"
    exit 2
  fi
fi

exit 0
