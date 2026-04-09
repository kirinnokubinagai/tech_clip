#!/usr/bin/env bats
# pre-push-review-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/pre-push-review-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/pre-push-review-guard.sh"

setup() {
    TMPDIR=$(mktemp -d)
    REPO_DIR="$TMPDIR/main"
    WORKTREE_BASE="$TMPDIR"

    mkdir -p "$REPO_DIR"
    git -C "$REPO_DIR" init -b main
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "initial" > "$REPO_DIR/file.txt"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "initial commit"
}

teardown() {
    rm -rf "$TMPDIR"
}

# ARGUMENTSを設定してスクリプトをworktreeから実行するヘルパー
run_script_with_args() {
    local args_json="$1"
    local run_dir="${2:-$REPO_DIR}"
    (cd "$run_dir" && ARGUMENTS="$args_json" bash "$SCRIPT")
}

@test "git pushを含まないコマンドはスキップされること" {
    # Arrange
    local args='{"command": "ls -la"}'

    # Act
    run run_script_with_args "$args"

    # Assert
    [ "$status" -eq 0 ]
}

@test "ARGUMENTSが空の場合はスキップされること" {
    # Arrange
    local args=''

    # Act
    run run_script_with_args "$args"

    # Assert
    [ "$status" -eq 0 ]
}

@test "jqがない場合はスキップされること" {
    # Arrange: jqの代わりにダミーを用意してエラーを返させる
    local fake_jq_dir="$TMPDIR/fake_bin"
    mkdir -p "$fake_jq_dir"
    # jq が存在しないことをシミュレートするため command -v jq が失敗するように
    # jqをダミーで上書き（常に失敗するjq）
    printf '#!/bin/bash\nexit 1\n' > "$fake_jq_dir/jq"
    chmod +x "$fake_jq_dir/jq"

    local args='{"command": "git push origin issue/764/test"}'

    # Act: ダミーjqをPATHの先頭に配置（command -v jq は成功するが jq 実行は失敗）
    # スクリプトのjqチェックは command -v jq なので、存在はするが壊れたjqの場合は
    # jq -r が空文字を返しコマンドが空になりスキップされること
    run bash -c "PATH='$fake_jq_dir:$PATH' ARGUMENTS='$args' bash '$SCRIPT'"

    # Assert: jqが壊れていてもスキップ(exit 0)されること
    [ "$status" -eq 0 ]
}

@test "マーカーなしでgit pushするとブロックされること（mainリポジトリから）" {
    # Arrange: .claudeディレクトリがある状態でマーカーなし
    mkdir -p "$REPO_DIR/.claude"
    local args='{"command": "git push origin issue/764/test"}'

    # Act
    run run_script_with_args "$args" "$REPO_DIR"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "worktreeのマーカーが存在する場合はpushが許可されること" {
    # Arrange: worktreeを作成してマーカーを配置
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/force-agent-teams-via-hooks
    mkdir -p "$wt_path/.claude"
    touch "$wt_path/.claude/.review-passed"

    local args='{"command": "git push origin issue/764/force-agent-teams-via-hooks"}'

    # Act: worktreeから実行
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "worktreeからpushする際にマーカーがない場合はブロックされること" {
    # Arrange: worktreeを作成するがマーカーは作成しない
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/force-agent-teams-via-hooks
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin issue/764/force-agent-teams-via-hooks"}'

    # Act: worktreeから実行
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "pushコマンドからブランチ名を正しく抽出してworktreeのマーカーを確認できること" {
    # Arrange: ブランチ名付きでworktreeを作成してマーカーを配置
    local wt_path="$WORKTREE_BASE/issue-999"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/999/some-feature
    mkdir -p "$wt_path/.claude"
    touch "$wt_path/.claude/.review-passed"

    local args='{"command": "git push origin issue/999/some-feature"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "git push -u originでマーカーがある場合はpushが許可されること" {
    # Arrange: `git push -u origin <branch>` の場合、awk '{print $NF}' でブランチ名を正しく抽出し
    # worktree list からマーカーパスを解決できることを検証
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/foo
    mkdir -p "$wt_path/.claude"
    touch "$wt_path/.claude/.review-passed"

    local args='{"command": "git push -u origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "git push -u originでマーカーがない場合はブロックされること" {
    # Arrange: awk '{print $NF}' でブランチ名 issue/764/foo を取得し、worktreeのマーカー不在を検出できることを検証
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/foo
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push -u origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "git push --set-upstream originでマーカーがある場合はpushが許可されること" {
    # Arrange
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/foo
    mkdir -p "$wt_path/.claude"
    touch "$wt_path/.claude/.review-passed"

    local args='{"command": "git push --set-upstream origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "git push --set-upstream originでマーカーがない場合はブロックされること" {
    # Arrange
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/foo
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push --set-upstream origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "mainブランチへのpushはブランチ抽出できない場合にCWDのマーカーを参照すること" {
    # Arrange: マーカーなし
    mkdir -p "$REPO_DIR/.claude"
    local args='{"command": "git push origin main"}'

    # Act
    run run_script_with_args "$args" "$REPO_DIR"

    # Assert: mainへのpushは設定でブロックされるが、ここではガード自体のロジックをテスト
    # マーカーがなければブロックされること
    [ "$status" -eq 2 ]
}
