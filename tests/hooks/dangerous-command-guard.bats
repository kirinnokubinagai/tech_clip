#!/usr/bin/env bats
# dangerous-command-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/dangerous-command-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/dangerous-command-guard.sh"

setup() {
    unset GIT_DIR GIT_WORK_TREE
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/main"

    mkdir -p "$REPO_DIR"
    git -C "$REPO_DIR" init -b main
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "initial" > "$REPO_DIR/file.txt"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "initial commit"
}

# stdin経由でコマンドを渡すヘルパー（Claude Code PreToolUse 形式）
run_hook() {
    local cmd="$1"
    local json="{\"tool_input\":{\"command\":\"$cmd\"}}"
    (cd "$REPO_DIR" && echo "$json" | bash "$SCRIPT")
}

@test "mainブランチ上の sed -i はブロックされること" {
    run run_hook "sed -i 's/foo/bar/g' file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "mainブランチ上の sed -E -i はブロックされること" {
    run run_hook "sed -E -i 's/foo/bar/g' file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "mainブランチ上の sed --in-place はブロックされること" {
    run run_hook "sed --in-place 's/foo/bar/g' file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "mainブランチ上の tee はブロックされること" {
    run run_hook "tee file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "featureブランチ上の sed -i は許可されること" {
    git -C "$REPO_DIR" checkout -b issue/test/feature
    run run_hook "sed -i 's/foo/bar/g' file.txt"
    [ "$status" -ne 2 ]
}

@test "featureブランチ上の tee は許可されること" {
    git -C "$REPO_DIR" checkout -b issue/test/feature
    run run_hook "tee file.txt"
    [ "$status" -ne 2 ]
}

@test "mainブランチ上の sed -E（インプレースなし）は許可されること" {
    run run_hook "sed -E 's/foo/bar/g' file.txt"
    [ "$status" -ne 2 ]
}

@test "mainブランチ上の通常の sed（-i なし）は許可されること" {
    run run_hook "sed 's/foo/bar/g' file.txt"
    [ "$status" -ne 2 ]
}

# Phase B-4: 実際の危険コマンドが stdin 経由で正しくブロックされること
@test "git config core.bare true はブロックされること" {
    run run_hook "git config core.bare true"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "$output" == *"危険"* ]]
}

@test "git config core.worktree /tmp はブロックされること" {
    run run_hook "git config core.worktree /tmp"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "$output" == *"危険"* ]]
}

@test "git reset --hard はブロックされること" {
    run run_hook "git reset --hard HEAD~1"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "$output" == *"危険"* ]]
}

@test "ls は許可されること" {
    run run_hook "ls -la"
    [ "$status" -ne 2 ]
}

@test "pnpm test は許可されること" {
    run run_hook "pnpm test"
    [ "$status" -ne 2 ]
}

@test "stdin が空のとき exit 0 すること" {
    run bash -c "(cd \"$REPO_DIR\" && echo '' | bash \"$SCRIPT\")"
    [ "$status" -eq 0 ]
}
