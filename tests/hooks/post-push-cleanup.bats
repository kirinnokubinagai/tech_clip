#!/usr/bin/env bats
# post-push-cleanup.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/post-push-cleanup.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/post-push-cleanup.sh"

setup() {
    unset GIT_DIR GIT_WORK_TREE
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/repo"

    mkdir -p "$REPO_DIR/.claude"
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

@test "git push を含まないコマンドはスキップされること" {
    local args='{"tool_input":{"command":"ls -la"}}'
    run run_hook "$args"
    [ "$status" -eq 0 ]
}

@test "git push 後に .review-passed マーカーが削除されること" {
    # Arrange: マーカーを配置
    local sha
    sha=$(git -C "$REPO_DIR" rev-parse HEAD)
    echo "$sha" > "$REPO_DIR/.claude/.review-passed"
    [ -f "$REPO_DIR/.claude/.review-passed" ]

    local args='{"tool_input":{"command":"git push origin main"}}'

    # Act
    run run_hook "$args" "$REPO_DIR"

    # Assert: マーカーが削除されていること
    [ "$status" -eq 0 ]
    [ ! -f "$REPO_DIR/.claude/.review-passed" ]
}

@test "git push 後に SHA が一致する .e2e-passed マーカーが削除されること" {
    # Arrange: e2e マーカーを配置（HEAD SHA）
    local sha
    sha=$(git -C "$REPO_DIR" rev-parse HEAD)
    echo "$sha" > "$REPO_DIR/.claude/.e2e-passed"
    [ -f "$REPO_DIR/.claude/.e2e-passed" ]

    local args='{"tool_input":{"command":"git push origin main"}}'

    # Act
    run run_hook "$args" "$REPO_DIR"

    # Assert: SHA 一致 → e2e マーカーも削除
    [ "$status" -eq 0 ]
    [ ! -f "$REPO_DIR/.claude/.e2e-passed" ]
}

@test "git push 後に SHA が不一致の .e2e-passed マーカーは残されること" {
    # Arrange: 古い SHA を e2e マーカーに書く
    echo "0000000000000000000000000000000000000000" > "$REPO_DIR/.claude/.e2e-passed"
    [ -f "$REPO_DIR/.claude/.e2e-passed" ]

    local args='{"tool_input":{"command":"git push origin main"}}'

    # Act
    run run_hook "$args" "$REPO_DIR"

    # Assert: SHA 不一致 → e2e マーカーは残る
    [ "$status" -eq 0 ]
    [ -f "$REPO_DIR/.claude/.e2e-passed" ]
}

@test "stdinにJSONを渡すとgit push後にマーカーが削除されること（stdin ルーティング確認）" {
    # Arrange: review マーカーを配置
    local sha
    sha=$(git -C "$REPO_DIR" rev-parse HEAD)
    echo "$sha" > "$REPO_DIR/.claude/.review-passed"

    # Act: stdin に tool_input.command を含む正しい JSON を渡す（$ARGUMENTS が空でも機能する）
    run bash -c "echo '{\"tool_input\":{\"command\":\"git push origin main\"}}' | (cd '$REPO_DIR' && bash '$SCRIPT')"

    # Assert: マーカーが削除されること
    [ "$status" -eq 0 ]
    [ ! -f "$REPO_DIR/.claude/.review-passed" ]
}
