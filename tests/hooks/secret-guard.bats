#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/secret-guard.sh"

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

# stdin経由でコマンドを渡すヘルパー
run_hook() {
    local cmd="$1"
    local json="{\"tool_input\":{\"command\":\"$cmd\"}}"
    (cd "$REPO_DIR" && echo "$json" | bash "$SCRIPT")
}

@test "secret-guard.sh: 構文エラーがない" {
    run bash -n "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "stdin が空のとき exit 0 すること" {
    run bash -c "(cd \"$REPO_DIR\" && echo '' | bash \"$SCRIPT\")"
    [ "$status" -eq 0 ]
}

@test "git push/commit 以外のコマンドは無視されること" {
    run run_hook "ls -la"
    [ "$status" -eq 0 ]
}

@test "git commit 時に JWT_SECRET が staged されていればブロックされること" {
    echo "JWT_SECRET=supersecret123" > "$REPO_DIR/config.txt"
    git -C "$REPO_DIR" add "$REPO_DIR/config.txt"
    run run_hook "git commit -m 'add config'"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]] || [[ "$output" == *"シークレット"* ]]
}

@test "git commit 時に通常ファイルのみ staged ならば許可されること" {
    echo "hello world" > "$REPO_DIR/safe.txt"
    git -C "$REPO_DIR" add "$REPO_DIR/safe.txt"
    run run_hook "git commit -m 'add safe file'"
    [ "$status" -eq 0 ]
}
