#!/usr/bin/env bats
# orchestrator-direct-edit-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/orchestrator-direct-edit-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/orchestrator-direct-edit-guard.sh"

setup() {
    TMPDIR=$(mktemp -d)
    REPO_DIR="$TMPDIR/main"

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

# CLAUDE_TOOL_INPUTを設定してスクリプトを実行するヘルパー
run_script_with_file() {
    local file_path="$1"
    local run_dir="${2:-$REPO_DIR}"
    local tool_input
    tool_input=$(printf '{"file_path": "%s"}' "$file_path")
    (cd "$run_dir" && CLAUDE_TOOL_INPUT="$tool_input" bash "$SCRIPT")
}

# --- orchestration/config ファイルは許可 ---

@test ".claude/hooks/配下のファイルは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test ".claude/skills/配下のファイルは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/skills/some-skill.md"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test ".claude/agents/配下のファイルは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/agents/coder.md"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "CLAUDE.mdは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/CLAUDE.md"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "flake.nixは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/flake.nix"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test ".gitignoreは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/.gitignore"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "settings.jsonは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/settings.json"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

# --- ソースファイルはブロック ---

@test "apps/配下の.tsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]] || [[ "${lines[*]}" == *"DENY"* ]]
}

@test "apps/配下の.tsxファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/mobile/src/components/App.tsx"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "packages/配下の.tsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/packages/shared/src/index.ts"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "tests/配下の.tsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/tests/api/routes/articles.test.ts"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "tests/配下の.shファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/tests/hooks/some.sh"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "apps/配下の.jsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/util.js"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

# --- file_pathが空の場合 ---

@test "CLAUDE_TOOL_INPUTが空の場合はスキップされること" {
    # Arrange
    local run_dir="$REPO_DIR"

    # Act
    run bash -c "cd '$run_dir' && CLAUDE_TOOL_INPUT='' bash '$SCRIPT'"

    # Assert
    [ "$status" -eq 0 ]
}

@test "file_pathが空文字の場合はスキップされること" {
    # Arrange
    local tool_input='{"file_path": ""}'
    local run_dir="$REPO_DIR"

    # Act
    run bash -c "cd '$run_dir' && CLAUDE_TOOL_INPUT='$tool_input' bash '$SCRIPT'"

    # Assert
    [ "$status" -eq 0 ]
}

# --- エラーメッセージの確認 ---

@test "ブロック時にcoder agentを使う旨のメッセージが出ること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"coder"* ]] || [[ "${lines[*]}" == *"coder"* ]]
}
