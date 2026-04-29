#!/usr/bin/env bats
# check-executable-shell-files.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/check-executable-shell-files.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/check-executable-shell-files.sh"

setup() {
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/repo"

    mkdir -p "$REPO_DIR/scripts"
    git -C "$REPO_DIR" init -b main >/dev/null
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
}


run_checker() {
    (cd "$REPO_DIR" && bash "$SCRIPT")
}

@test "shell shebang の .sh が 100755 なら通る" {
    cat > "$REPO_DIR/scripts/ok.sh" <<'EOF'
#!/usr/bin/env bash
echo ok
EOF
    chmod +x "$REPO_DIR/scripts/ok.sh"
    git -C "$REPO_DIR" add scripts/ok.sh
    git -C "$REPO_DIR" commit -m "add ok" >/dev/null

    run run_checker
    [ "$status" -eq 0 ]
}

@test "拡張子なしでも shell shebang なら 100755 を要求する" {
    cat > "$REPO_DIR/scripts/run-tool" <<'EOF'
#!/bin/bash
echo run
EOF
    git -C "$REPO_DIR" add scripts/run-tool
    git -C "$REPO_DIR" update-index --chmod=-x scripts/run-tool
    git -C "$REPO_DIR" commit -m "add tool" >/dev/null

    run run_checker
    [ "$status" -eq 1 ]
    [[ "$output" == *"scripts/run-tool"* ]]
}

@test ".bats は shell shebang でも executable bit を要求しない" {
    mkdir -p "$REPO_DIR/tests/hooks"
    cat > "$REPO_DIR/tests/hooks/example.bats" <<'EOF'
#!/usr/bin/env bats
@test "example" {
  true
}
EOF
    git -C "$REPO_DIR" add tests/hooks/example.bats
    git -C "$REPO_DIR" commit -m "add bats" >/dev/null

    run run_checker
    [ "$status" -eq 0 ]
}
