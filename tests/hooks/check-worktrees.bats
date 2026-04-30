#!/usr/bin/env bats
# check-worktrees.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/check-worktrees.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/check-worktrees.sh"

# テスト用の一時的なgitリポジトリをセットアップ
setup() {
    unset GIT_DIR GIT_WORK_TREE
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/main"
    WORKTREE_BASE="$TMPDIR"

    # mainリポジトリを初期化（bare remoteの代わりにローカルで模倣）
    mkdir -p "$REPO_DIR"
    git -C "$REPO_DIR" init -b main
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "initial" > "$REPO_DIR/file.txt"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "initial commit"

    # origin/main を模倣するためにリモートを自身に向ける
    git -C "$REPO_DIR" remote add origin "$REPO_DIR"
    git -C "$REPO_DIR" fetch origin main --quiet
}


# スクリプトをREPO_DIR配下で実行するヘルパー
run_script() {
    git -C "$REPO_DIR" worktree list --porcelain > /dev/null  # git context確認
    (cd "$REPO_DIR" && bash "$SCRIPT")
}

@test "worktreeが存在しない場合は何も出力せず終了コード0" {
    run run_script
    [ "$status" -eq 0 ]
    [ -z "$output" ]
}

@test "マージ済み・クリーンなworktreeは自動削除される" {
    # worktreeを作成してコミット
    WT_PATH="$WORKTREE_BASE/issue-test"
    git -C "$REPO_DIR" worktree add "$WT_PATH" -b issue/test/feature
    echo "feature" > "$WT_PATH/feature.txt"
    git -C "$WT_PATH" add .
    git -C "$WT_PATH" commit -m "feature commit"

    # mainにマージ（origin/mainに反映）
    git -C "$REPO_DIR" merge issue/test/feature --no-ff -m "merge feature"
    git -C "$REPO_DIR" fetch origin main --quiet

    # worktreeが存在することを確認
    [ -d "$WT_PATH" ]

    run run_script
    [ "$status" -eq 0 ]

    # worktreeが削除されたことを確認
    [ ! -d "$WT_PATH" ]

    # 削除メッセージが出力されていること
    [[ "$output" == *"自動削除"* ]]
}

@test "マージ済みでも未コミット変更があるworktreeは削除されない" {
    # worktreeを作成してコミット
    WT_PATH="$WORKTREE_BASE/issue-dirty"
    git -C "$REPO_DIR" worktree add "$WT_PATH" -b issue/dirty/feature
    echo "feature" > "$WT_PATH/feature.txt"
    git -C "$WT_PATH" add .
    git -C "$WT_PATH" commit -m "feature commit"

    # mainにマージ（origin/mainに反映）
    git -C "$REPO_DIR" merge issue/dirty/feature --no-ff -m "merge feature"
    git -C "$REPO_DIR" fetch origin main --quiet

    # 未コミットの変更を追加
    echo "dirty change" > "$WT_PATH/dirty.txt"
    git -C "$WT_PATH" add dirty.txt

    run run_script
    [ "$status" -eq 0 ]

    # worktreeが削除されていないことを確認
    [ -d "$WT_PATH" ]
}

@test "mainより遅れているworktreeは[遅れ]として報告される" {
    # worktreeを作成
    WT_PATH="$WORKTREE_BASE/issue-behind"
    git -C "$REPO_DIR" worktree add "$WT_PATH" -b issue/behind/feature

    # mainに新しいコミットを追加（worktreeは遅れた状態に）
    echo "new on main" > "$REPO_DIR/main-change.txt"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "main progress"
    git -C "$REPO_DIR" fetch origin main --quiet

    run run_script
    [ "$status" -eq 0 ]

    # 遅れの警告が出力されていること
    [[ "$output" == *"遅れ"* ]]
    [[ "$output" == *"issue-behind"* ]]
}

@test "REPO_ROOT直下にネストされたworktreeは[ネスト]として報告される" {
    # REPO_ROOT内部にworktreeを作成（ネスト状態）
    WT_NESTED="$REPO_DIR/nested-worktree"
    git -C "$REPO_DIR" worktree add "$WT_NESTED" -b issue/nested/bad

    run run_script
    [ "$status" -eq 0 ]

    # ネスト警告が出力されていること
    [[ "$output" == *"ネスト"* ]]
}
