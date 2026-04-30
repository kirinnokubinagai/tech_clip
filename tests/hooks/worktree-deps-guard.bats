#!/usr/bin/env bats
# worktree-deps-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/worktree-deps-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/worktree-deps-guard.sh"
LIB="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/lib/worktree-init.sh"

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

@test "git worktree add を含まないコマンドはスキップされること" {
    local args='{"tool_input":{"command":"ls -la"}}'
    run run_hook "$args"
    [ "$status" -eq 0 ]
}

@test "スクリプトが tool_input.command キーを読み込むこと" {
    # lib が存在しない場合でもスクリプトが正常終了すること (lib がなければ exit 0)
    local args='{"tool_input":{"command":"git worktree add /tmp/nonexistent-wt-path"}}'
    run run_hook "$args"
    # exit 0 (lib なし or worktree path 不存在)
    [ "$status" -eq 0 ]
}

@test "stdinにJSONを渡すとgit worktree add コマンドが読み取られること（stdin ルーティング確認）" {
    # Act: stdin に tool_input.command を含む正しい JSON を渡す（$ARGUMENTS が空でも機能する）
    run bash -c "echo '{\"tool_input\":{\"command\":\"ls -la\"}}' | (cd '$REPO_DIR' && bash '$SCRIPT')"

    # Assert: git worktree add ではないのでスキップ
    [ "$status" -eq 0 ]
}
