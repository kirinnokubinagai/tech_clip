#!/usr/bin/env bats
# dangerous-command-guard.sh の check_main_branch_write テスト
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


# ARGUMENTS JSON を組み立てて hook を実行するヘルパー
run_hook() {
    local cmd="$1"
    (cd "$REPO_DIR" && ARGUMENTS="{\"command\":\"$cmd\"}" bash "$SCRIPT")
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
