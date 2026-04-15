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

# stdin に tool_input.file_path 形式の JSON を渡してスクリプトを実行するヘルパー
run_script_with_file() {
    local file_path="$1"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')
    run bash -c "cd '$REPO_DIR' && echo '$input' | bash '$SCRIPT'"
}

# --- mainブランチ上では orchestration/config ファイルもブロックされる ---
# (step 4: main ブランチ全 DENY が step 5: orchestration_file 許可より先に評価される)

@test "mainブランチ上の.claude/hooks/配下のファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "mainブランチ上の.claude/skills/配下のファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/skills/some-skill.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "mainブランチ上の.claude/agents/配下のファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/agents/coder.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "mainブランチ上のCLAUDE.mdはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/CLAUDE.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "mainブランチ上のflake.nixはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/flake.nix"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "mainブランチ上の.gitignoreはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.gitignore"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "mainブランチ上のsettings.jsonはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.claude/settings.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

# --- non-mainブランチでは orchestration/config ファイルは許可 ---

@test "非mainブランチの.claude/hooks/配下のファイルは許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "非mainブランチのCLAUDE.mdは許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/CLAUDE.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "非mainブランチのflake.nixは許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/flake.nix"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

# --- ソースファイルはmainブランチではブロック ---

@test "apps/配下の.tsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "apps/配下の.tsxファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/mobile/src/components/App.tsx"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "packages/配下の.tsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/packages/shared/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "tests/配下の.tsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/tests/api/routes/articles.test.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "tests/配下の.shファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/tests/hooks/some.sh"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "apps/配下の.jsファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/util.js"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

# --- mainブランチ上でもdocs系はブロックされる ---

@test "mainブランチ上のdocs/ROADMAP.mdはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/docs/ROADMAP.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "mainブランチ上のREADME.mdはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/README.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

# --- file_pathが空の場合 ---

@test "stdinが空の場合はスキップされること" {
    # Arrange
    local run_dir="$REPO_DIR"

    # Act
    run bash -c "cd '$run_dir' && echo '' | bash '$SCRIPT'"

    # Assert
    [ "$status" -eq 0 ]
}

@test "file_pathが空文字の場合はスキップされること" {
    # Arrange
    local tool_input='{"tool_input":{"file_path":""}}'
    local run_dir="$REPO_DIR"

    # Act
    run bash -c "cd '$run_dir' && echo '$tool_input' | bash '$SCRIPT'"

    # Assert
    [ "$status" -eq 0 ]
}

# --- package.json の許可・ブロック判定 ---

@test "mainブランチ上のルートpackage.jsonはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/package.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "./package.jsonは相対パスのためブロックされること" {
    # Arrange
    # 相対パスは安全でないとして拒否される（MEDIUM-1修正）
    local file_path="./package.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"相対パスは安全でないため拒否します"* ]]
}

@test "apps/api/package.jsonはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/package.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "packages/shared/package.jsonはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/packages/shared/package.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

# --- エラーメッセージの確認 ---

@test "ブロック時にcoder agentを使う旨のメッセージが出ること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"coder"* ]]
}

# --- 明示的ブロック対象（is_blocked_file）---

@test ".omc/state/配下のファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.omc/state/autopilot-state.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "大文字パスの.OMC/STATE/配下のファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.OMC/STATE/autopilot-state.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "パストラバーサル経由の.omc/state/配下のファイルはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.omc/logs/../state/autopilot-state.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test ".omc/stateディレクトリ自体はブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/.omc/state"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "大文字パスの.OMC/STATEで正しい理由メッセージが出ること" {
    # Arrange
    local file_path="$REPO_DIR/.OMC/STATE/x.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"実行フロー状態ファイル"* ]]
}


# --- .omc/ 全体の許可（.omc/state/ 除く）---

@test ".omc/notepad.mdは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/.omc/notepad.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test ".omc/project-memory.jsonは許可されること" {
    # Arrange
    local file_path="$REPO_DIR/.omc/project-memory.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

# --- サブディレクトリの設定ファイル名偽装はブロックされること ---

@test "apps/api/flake.nixはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/flake.nix"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "apps/api/CLAUDE.mdはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/CLAUDE.md"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "apps/api/turbo.jsonはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/turbo.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "apps/api/src/.claude/foo.tsはブロックされること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/.claude/foo.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

# --- ブランチ判定ロジック ---

@test "worktreeの非mainブランチではapps/配下のソースファイル編集が許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "worktreeの非mainブランチでもpackages/配下の編集が許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/packages-branch
    local file_path="$REPO_DIR/packages/shared/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}

@test "detached HEAD状態ではapps/配下のソースファイル編集がブロックされること" {
    # Arrange
    local commit_hash
    commit_hash=$(git -C "$REPO_DIR" rev-parse HEAD)
    git -C "$REPO_DIR" checkout --detach "$commit_hash"
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}


@test "detached HEAD状態でも.omc/state/配下はブロックされること" {
    # Arrange
    local commit_hash
    commit_hash=$(git -C "$REPO_DIR" rev-parse HEAD)
    git -C "$REPO_DIR" checkout --detach "$commit_hash"
    run_script_with_file "$REPO_DIR/.omc/state/autopilot-state.json"
    [ "$status" -eq 2 ]
    [[ "${output}" == *"実行フロー状態ファイル"* ]]
}

@test "detached HEAD状態でもorchestrationファイルはブロックされること" {
    # Arrange
    local commit_hash
    commit_hash=$(git -C "$REPO_DIR" rev-parse HEAD)
    git -C "$REPO_DIR" checkout --detach "$commit_hash"
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
}

@test "worktreeの非mainブランチでも.omc/state/配下のEdit/Writeはブロックされること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/state-branch
    local file_path="$REPO_DIR/.omc/state/autopilot-state.json"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "worktreeの非mainブランチでも.claude/.review-passedの書き込みは許可されること" {
    # Arrange
    # 新スクリプトでは .review-passed の明示ブロックを除去。
    # non-main ブランチでは step 5 の orchestration_file として許可（reviewer が Write ツールで作成可能）
    git -C "$REPO_DIR" checkout -b feature/review-branch
    local file_path="$REPO_DIR/.claude/.review-passed"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 0 ]
}
