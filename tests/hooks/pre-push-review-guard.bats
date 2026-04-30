#!/usr/bin/env bats
# pre-push-review-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/pre-push-review-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/pre-push-review-guard.sh"

setup() {
  unset GIT_DIR GIT_WORK_TREE
    TMPDIR="$BATS_TEST_TMPDIR"
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


# ARGUMENTSを設定してスクリプトをworktreeから実行するヘルパー
run_script_with_args() {
    local args_json="$1"
    local run_dir="${2:-$REPO_DIR}"
    (cd "$run_dir" && ARGUMENTS="$args_json" bash "$SCRIPT")
}

run_script_with_args_and_path() {
    local args_json="$1"
    local custom_path="$2"
    local run_dir="${3:-$REPO_DIR}"
    (cd "$run_dir" && PATH="$custom_path" ARGUMENTS="$args_json" bash "$SCRIPT")
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

@test "jqが壊れていてもマーカーなしならブロックされること" {
    # Arrange: jqの代わりにダミーを用意してエラーを返させる
    local fake_jq_dir="$TMPDIR/fake_bin"
    mkdir -p "$fake_jq_dir"
    # jqをダミーで上書き（常に失敗するjq）
    printf '#!/bin/bash\nexit 1\n' > "$fake_jq_dir/jq"
    chmod +x "$fake_jq_dir/jq"

    mkdir -p "$REPO_DIR/.claude"
    local args='{"command": "git push origin issue/764/test"}'

    # Act: jq失敗時も grep/sed フォールバックで command を抽出してガード継続
    run run_script_with_args_and_path "$args" "$fake_jq_dir:$PATH" "$REPO_DIR"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "jqが壊れていてもマーカーがあれば許可されること" {
    # Arrange
    local fake_jq_dir="$TMPDIR/fake_bin"
    mkdir -p "$fake_jq_dir"
    printf '#!/bin/bash\nexit 1\n' > "$fake_jq_dir/jq"
    chmod +x "$fake_jq_dir/jq"

    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/test
    mkdir -p "$wt_path/.claude"
    git -C "$wt_path" rev-parse HEAD > "$wt_path/.claude/.review-passed"

    local args='{"command": "git push origin issue/764/test"}'

    # Act
    run run_script_with_args_and_path "$args" "$fake_jq_dir:$PATH" "$wt_path"

    # Assert
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
    git -C "$wt_path" rev-parse HEAD > "$wt_path/.claude/.review-passed"

    local args='{"command": "git push origin issue/764/force-agent-teams-via-hooks"}'

    # Act: worktreeから実行
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "worktreeからpushする際にissue/* branchはマーカーなしでも許可されること (branch 短絡)" {
    # Arrange: worktreeを作成するがマーカーは作成しない
    # branch 戦略 (#1138): issue/* は CI gate に委譲するため marker 不要
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/force-agent-teams-via-hooks
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin issue/764/force-agent-teams-via-hooks"}'

    # Act: worktreeから実行
    run run_script_with_args "$args" "$wt_path"

    # Assert: issue/* は短絡 exit 0
    [ "$status" -eq 0 ]
}

@test "pushコマンドからブランチ名を正しく抽出してworktreeのマーカーを確認できること" {
    # Arrange: ブランチ名付きでworktreeを作成してマーカーを配置
    local wt_path="$WORKTREE_BASE/issue-999"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/999/some-feature
    mkdir -p "$wt_path/.claude"
    git -C "$wt_path" rev-parse HEAD > "$wt_path/.claude/.review-passed"

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
    git -C "$wt_path" rev-parse HEAD > "$wt_path/.claude/.review-passed"

    local args='{"command": "git push -u origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "git push -u originでissue/* branchはマーカーなしでも許可されること (branch 短絡)" {
    # Arrange: branch 戦略 (#1138): issue/* は CI gate に委譲するため marker 不要
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/foo
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push -u origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert: issue/* は短絡 exit 0
    [ "$status" -eq 0 ]
}

@test "git push --set-upstream originでマーカーがある場合はpushが許可されること" {
    # Arrange
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/foo
    mkdir -p "$wt_path/.claude"
    git -C "$wt_path" rev-parse HEAD > "$wt_path/.claude/.review-passed"

    local args='{"command": "git push --set-upstream origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "git push --set-upstream originでissue/* branchはマーカーなしでも許可されること (branch 短絡)" {
    # Arrange: branch 戦略 (#1138): issue/* は CI gate に委譲するため marker 不要
    local wt_path="$WORKTREE_BASE/issue-764"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/764/foo
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push --set-upstream origin issue/764/foo"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert: issue/* は短絡 exit 0
    [ "$status" -eq 0 ]
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

@test "issue/* branch からの push はマーカーなしでも許可されること (branch 短絡)" {
    # Arrange: issue/* branch worktree を作成するがマーカーは作成しない
    local wt_path="$WORKTREE_BASE/issue-1138"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/1138/branch-strategy
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin issue/1138/branch-strategy"}'

    # Act: issue/* は短絡で exit 0 (marker 不要)
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "feature/* branch からの push はマーカーなしでも許可されること (branch 短絡)" {
    # Arrange: feature/* branch worktree を作成するがマーカーは作成しない
    local wt_path="$WORKTREE_BASE/feature-test"
    git -C "$REPO_DIR" worktree add "$wt_path" -b feature/new-ui
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin feature/new-ui"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "stage branch からの push はマーカーが必要なこと (短絡なし)" {
    # Arrange: stage branch worktree を作成してマーカーなし
    local wt_path="$WORKTREE_BASE/stage-wt"
    git -C "$REPO_DIR" worktree add "$wt_path" -b stage
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin stage"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert: stage branch はマーカー必須 → ブロック
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "stage branch からの push はマーカーがあれば許可されること" {
    # Arrange: stage branch worktree を作成してマーカーを配置
    local wt_path="$WORKTREE_BASE/stage-wt"
    git -C "$REPO_DIR" worktree add "$wt_path" -b stage
    mkdir -p "$wt_path/.claude"
    git -C "$wt_path" rev-parse HEAD > "$wt_path/.claude/.review-passed"

    local args='{"command": "git push origin stage"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}
