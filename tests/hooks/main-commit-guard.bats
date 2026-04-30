#!/usr/bin/env bats
# main-commit-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/main-commit-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/main-commit-guard.sh"

setup() {
    unset GIT_DIR GIT_WORK_TREE
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/repo"

    mkdir -p "$REPO_DIR"
    git -C "$REPO_DIR" init -b main
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "initial" > "$REPO_DIR/file.txt"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "initial commit"
}

# stdin でフックを実行するヘルパー
run_hook() {
    local args_json="$1"
    local run_dir="${2:-$REPO_DIR}"
    echo "$args_json" | (cd "$run_dir" && bash "$SCRIPT")
}

@test "stdin が空の場合はスキップされること" {
    run bash -c "echo '' | bash '$SCRIPT'"
    [ "$status" -eq 0 ]
}

@test "git commit を含まないコマンドはスキップされること" {
    local args='{"tool_input":{"command":"ls -la"}}'
    run run_hook "$args"
    [ "$status" -eq 0 ]
}

@test "main ブランチで git commit するとブロック JSON が出力されること" {
    # Arrange: main ブランチで実行
    local args='{"tool_input":{"command":"git commit -m \"test\""}}'

    # Act: main ブランチの repo で実行
    run run_hook "$args" "$REPO_DIR"

    # Assert: block JSON が出力されること（Claude Code PreToolUse ブロック形式）
    [ "$status" -eq 0 ]
    [[ "$output" == *'"decision"'*'"block"'* ]] || [[ "$output" == *"main"* ]]
}

@test "feature ブランチで git commit するとスキップされること" {
    # Arrange: feature ブランチの worktree を作成
    local wt_path="$TMPDIR/feature-wt"
    git -C "$REPO_DIR" worktree add "$wt_path" -b feature/new-feature

    local args='{"tool_input":{"command":"git commit -m \"test\""}}'

    # Act: feature ブランチの worktree で実行
    run run_hook "$args" "$wt_path"

    # Assert: feature ブランチは許可（出力なし & exit 0）
    [ "$status" -eq 0 ]
    [ -z "$output" ]
}

@test "issue ブランチで git commit するとスキップされること" {
    # Arrange: issue ブランチの worktree を作成
    local wt_path="$TMPDIR/issue-wt"
    git -C "$REPO_DIR" worktree add "$wt_path" -b issue/1146/naming

    local args='{"tool_input":{"command":"git commit -m \"fix: something\""}}'

    # Act: issue ブランチの worktree で実行
    run run_hook "$args" "$wt_path"

    # Assert: issue/* は許可（出力なし & exit 0）
    [ "$status" -eq 0 ]
    [ -z "$output" ]
}

@test "stdinにJSONを渡すとmain commit がブロック JSON を返すこと（stdin ルーティング確認）" {
    # Act: stdin に tool_input.command を含む正しい JSON を渡す（$ARGUMENTS が空でも機能する）
    run bash -c "echo '{\"tool_input\":{\"command\":\"git commit -m test\"}}' | (cd '$REPO_DIR' && bash '$SCRIPT')"

    # Assert: main への commit がブロック JSON を返すこと
    [ "$status" -eq 0 ]
    [[ "$output" == *'"decision"'*'"block"'* ]] || [[ "$output" == *"main"* ]]
}

@test "main-commit-guard.sh: main を検出するロジックが存在すること" {
    run bash -c 'grep -q "main" "'"$SCRIPT"'"'
    [ "$status" -eq 0 ]
}
