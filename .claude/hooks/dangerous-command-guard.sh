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

# worktreeパスの検証（WORKTREE_BASE 直下の兄弟ディレクトリか）
check_worktree_path() {
  local cmd="$1"

  if ! echo "$cmd" | grep -qE "git worktree add "; then
    return 1
  fi

  local wt_path
  local resolved_path
  local repo_root
  local expected_prefix
  # -b フラグとそのブランチ名をスキップしてパスを抽出
  # sed の末尾スペース必須パターンは -b branch がコマンド末尾の場合にマッチしないため
  # sed で除去し、awk でパスを先に取り出すことで吸収する
  wt_path=$(echo "$cmd" | sed 's/.*git worktree add //' | sed 's/ *-b [^ ]*//' | awk '{print $1}' | tr -d "'\"")

  if [[ "$wt_path" == *'$'* ]]; then
    echo "⚠️ 未展開の変数が含まれています。絶対パスに展開してから実行してください"
    return 0
  fi
  repo_root=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd)
  local worktree_base
  worktree_base=$(dirname "$repo_root")
  expected_prefix="${worktree_base}/"

  # realpath -m でシンボリックリンクや .. を正規化（存在しないパスでも動作）
  # 絶対パスの場合はそのまま使用し、相対パスの場合のみ $(pwd) を付加する
  # 注意: ${REPO_ROOT} 等のシェル変数が未展開のリテラルで渡される場合、
  #       realpath -m が意図しないパスを返すことがある
  resolved_path=$(realpath -m "$wt_path" 2>/dev/null || { [[ "$wt_path" = /* ]] && echo "$wt_path" || echo "$(pwd)/$wt_path"; })

  if [[ "$resolved_path" != "${expected_prefix}"* ]]; then
    echo "⚠️ worktreeの作成先が ${expected_prefix} 配下ではありません"
    echo "  指定パス: $wt_path"
    echo "  解決先:   $resolved_path"
    echo "  正しい例: ${expected_prefix}issue-N"
    return 0
  fi

  # REPO_ROOT内部に作成しようとしている場合はブロック
  if [[ "$resolved_path" == "${repo_root}/"* ]]; then
    echo "⚠️ worktreeがリポジトリ内部にネストしています"
    echo "  解決先: $resolved_path"
    echo "  正しい例: ${expected_prefix}issue-N（mainと兄弟ディレクトリ）"
    return 0
  fi

  local subpath="${resolved_path#${expected_prefix}}"
  if [[ "$subpath" == */* ]]; then
    echo "⚠️ worktreeが ${worktree_base}/ の直下ではなくネストしています"
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
  echo "$cmd" | grep -qE "git revert " && return 0
  echo "$cmd" | grep -qE "git reset --soft" && return 0
  echo "$cmd" | grep -qE "git reset --mixed" && return 0
  echo "$cmd" | grep -qE "git reset --hard" && return 0
  echo "$cmd" | grep -qE "git push.*--force" && return 0
  echo "$cmd" | grep -qE "git push.*-f[ $]" && return 0
  echo "$cmd" | grep -qE "git checkout -- " && return 0
  echo "$cmd" | grep -qE "git clean" && return 0
  echo "$cmd" | grep -qE "git branch -D" && return 0
  echo "$cmd" | grep -qE "git restore" && return 0
  # Gitの管理対象を手動でねじ曲げる操作は禁止
  echo "$cmd" | grep -qE "(^| )GIT_DIR=" && return 0
  echo "$cmd" | grep -qE "(^| )GIT_WORK_TREE=" && return 0
  echo "$cmd" | grep -qE "git +--git-dir(=| )" && return 0
  # core.bare / core.worktree は main の config と worktree 判定を壊すため全形式をブロック
  echo "$cmd" | grep -qE "git config.*core\.bare" && return 0
  echo "$cmd" | grep -qE "git config.*core\.worktree" && return 0

  # git checkout でファイル復元を検出（ブランチ切替は許可）
  # [^-] により -b / --orphan / --track 等のフラグ付きコマンドは自動除外
  if echo "$cmd" | grep -qE "git checkout [^-]"; then
    local target
    target=$(echo "$cmd" | sed 's/.*git checkout //; s/ *[&|;].*//')
    if ! git rev-parse --verify "$target" &>/dev/null; then
      return 0
    fi
  fi

  # システムコマンド
  echo "$cmd" | grep -qE "^kill " && return 0
  echo "$cmd" | grep -qE "^killall " && return 0
  echo "$cmd" | grep -qE "chmod 777" && return 0
  echo "$cmd" | grep -qE "^sudo " && return 0

  return 1
}

# CI ゲート判定ラベルの手動操作をブロック
check_label_manipulation() {
  local cmd="$1"

  # gh pr edit / gh issue edit / gh pr create で --add-label / --remove-label / --label を検出
  if ! echo "$cmd" | grep -qE "gh +(pr|issue) +(edit|create)"; then
    return 1
  fi

  if ! echo "$cmd" | grep -qE -- "--(add|remove)-label|^gh +pr +(edit|create).*--label"; then
    return 1
  fi

  # 保護対象ラベルパターン (大文字小文字無視)
  # "AI Review", "AI-Review", "ai review", "ai-review" すべてカバー
  # シングルクォート / ダブルクォートどちらでも検出
  if echo "$cmd" | grep -qiE -- "--(add|remove)-label[ =]+['\"]?ai[- ]review|--label[ =]+['\"]?ai[- ]review"; then
    echo "DENY: AI Review 系ラベルの手動操作は禁止されています"
    echo "  コマンド: $cmd"
    echo ""
    echo "  AI Review: NEEDS WORK / APPROVED / SKIPPED は claude-review bot の自動判定です"
    echo "  ラベルを外して CI をバイパスすることはできません"
    echo "  修正対応: bot の指摘内容（改善提案も含め全件）を修正してから push してください"
    echo "     - bot コメントの確認: gh pr view <PR#> --comments"
    echo "     - 修正後 push で bot が再評価し、ラベルを自動更新します"
    return 0
  fi

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
  local pr_num
  pr_num=$(echo "$cmd" | grep -oE "gh pr merge [0-9]+" | grep -oE "[0-9]+")
  if [ -z "$pr_num" ]; then
    return 1
  fi

  # gh CLIが使えない場合はスキップ
  if ! command -v gh &> /dev/null; then
    return 1
  fi

  # PRにレビューコメントがあるか確認
  local repo
  repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)
  if [ -z "$repo" ]; then
    return 1
  fi
  local review_count
  review_count=$(gh api "repos/$repo/pulls/$pr_num/reviews" --jq 'length' 2>/dev/null)
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

# mainブランチ上でのBashファイル書き込みコマンドをブロック
check_main_branch_write() {
  local cmd="$1"

  # sed -i / sed --in-place / tee のみ対象（リダイレクト検出は誤検知リスクが高いため除外）
  # sed パターン: -i または --in-place がスペース区切りのフラグとして現れるケースを検出する
  # tee パターン: (^| ) で "tee" コマンド以外の文字列内 "tee" を除外する（BSD grep 互換）
  if ! echo "$cmd" | grep -qE "(sed( +[^ ]+)* +-i( |$)|sed( +[^ ]+)* +--in-place( |$)|(^| )tee +)"; then
    return 1
  fi

  # env -u GIT_DIR -u GIT_WORK_TREE で GIT_DIR 汚染を回避してブランチ取得
  local branch
  branch=$(env -u GIT_DIR -u GIT_WORK_TREE git branch --show-current 2>/dev/null || echo "")
  if [ "$branch" != "main" ]; then
    return 1
  fi

  echo "DENY: mainブランチ上での直接ファイル書き込みは禁止されています"
  echo "  コマンド: $cmd"
  echo "  対策: worktreeを作成して作業してください"
  echo "  例: git worktree add \$(dirname \$(git rev-parse --show-toplevel))/issue-N -b issue/N/desc"
  return 0
}

if check_dangerous "$COMMAND"; then
  echo "⚠️ 危険なコマンドを検知しました"
  echo "コマンド: $COMMAND"
  echo ""
  echo "このコマンドは config / index / worktree を壊す可能性があります。"
  exit 2
fi

if check_label_manipulation "$COMMAND"; then
  exit 2
fi

if check_main_branch_write "$COMMAND"; then
  exit 2
fi

if check_worktree_path "$COMMAND"; then
  exit 2
fi

if check_merge_without_review "$COMMAND"; then
  exit 2
fi

# PR作成前のテスト通過チェック（警告のみ、ブロックしない）
if echo "$COMMAND" | grep -qE "gh pr create"; then
  if command -v pnpm &>/dev/null; then
    if ! timeout 60 pnpm test 2>/dev/null; then
      echo "⚠️ テストが失敗しています。PR作成前にテストを修正することを推奨します。"
    fi
  fi
fi

exit 0
