#!/usr/bin/env bats
# pre-push-e2e-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/pre-push-e2e-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/pre-push-e2e-guard.sh"
RULES="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/gate-rules.json"

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


run_script_with_args() {
    local args_json="$1"
    local run_dir="${2:-$REPO_DIR}"
    (cd "$run_dir" && ARGUMENTS="$args_json" bash "$SCRIPT")
}

@test "git push を含まないコマンドはスキップされること" {
    # Arrange
    local args='{"command": "ls -la"}'

    # Act
    run run_script_with_args "$args"

    # Assert
    [ "$status" -eq 0 ]
}

@test "ARGUMENTS が空の場合はスキップされること" {
    # Arrange
    local args=''

    # Act
    run run_script_with_args "$args"

    # Assert
    [ "$status" -eq 0 ]
}

@test "issue/* branch からの push はマーカーなしでも許可されること (branch 短絡)" {
    # Arrange: issue/* branch worktree を作成するがマーカーは作成しない
    local wt_path="$WORKTREE_BASE/issue-1138"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/1138/branch-strategy
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin issue/1138/branch-strategy"}'

    # Act: issue/* は短絡で exit 0 (e2e marker 不要)
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "feature/* branch からの push はマーカーなしでも許可されること (branch 短絡)" {
    # Arrange
    local wt_path="$WORKTREE_BASE/feature-test"
    git -C "$REPO_DIR" worktree add "$wt_path" -b feature/new-ui
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin feature/new-ui"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "stage branch からの push は e2e マーカーが必要なこと (短絡なし)" {
    # Arrange: stage branch worktree を作成してマーカーなし
    # evaluate-paths.sh がない環境でのデフォルト動作 → ブロック
    local wt_path="$WORKTREE_BASE/stage-wt"
    git -C "$REPO_DIR" worktree add "$wt_path" -b stage
    mkdir -p "$wt_path/.claude"

    local args='{"command": "git push origin stage"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert: stage branch はマーカー必須 (evaluate-paths.sh が無ければブロック)
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "stage branch からの push は e2e マーカーがあれば許可されること" {
    # Arrange: stage branch worktree でマーカーを配置
    local wt_path="$WORKTREE_BASE/stage-wt"
    git -C "$REPO_DIR" worktree add "$wt_path" -b stage
    mkdir -p "$wt_path/.claude"
    git -C "$wt_path" rev-parse HEAD > "$wt_path/.claude/.e2e-passed"

    local args='{"command": "git push origin stage"}'

    # Act
    run run_script_with_args "$args" "$wt_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "stage branch でマーカー内容が不正形式の場合はブロックされること" {
    # Arrange: stage branch でマーカーに不正な内容を書く
    # 注: stage branch は 1 worktree に 1 つしか作れないので別リポジトリを使う
    local alt_repo="$TMPDIR/alt-main"
    mkdir -p "$alt_repo"
    git -C "$alt_repo" init -b main
    git -C "$alt_repo" config user.email "test@example.com"
    git -C "$alt_repo" config user.name "Test"
    echo "initial" > "$alt_repo/file.txt"
    git -C "$alt_repo" add .
    git -C "$alt_repo" commit -m "init" --quiet
    local alt_wt="$TMPDIR/alt-stage"
    git -C "$alt_repo" worktree add "$alt_wt" -b stage
    mkdir -p "$alt_wt/.claude"
    echo "not-a-sha" > "$alt_wt/.claude/.e2e-passed"

    local args='{"command": "git push origin stage"}'

    # Act
    run run_script_with_args "$args" "$alt_wt"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "stage branch でマーカー SHA が HEAD と不一致の場合はブロックされること" {
    # Arrange: stage branch で古い SHA をマーカーに書く
    local alt_repo2="$TMPDIR/alt-main2"
    mkdir -p "$alt_repo2"
    git -C "$alt_repo2" init -b main
    git -C "$alt_repo2" config user.email "test@example.com"
    git -C "$alt_repo2" config user.name "Test"
    echo "initial" > "$alt_repo2/file.txt"
    git -C "$alt_repo2" add .
    git -C "$alt_repo2" commit -m "init" --quiet
    local alt_wt2="$TMPDIR/alt-stage2"
    git -C "$alt_repo2" worktree add "$alt_wt2" -b stage
    mkdir -p "$alt_wt2/.claude"
    echo "0000000000000000000000000000000000000000" > "$alt_wt2/.claude/.e2e-passed"

    local args='{"command": "git push origin stage"}'

    # Act
    run run_script_with_args "$args" "$alt_wt2"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}
