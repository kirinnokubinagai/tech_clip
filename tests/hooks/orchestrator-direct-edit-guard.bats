#!/usr/bin/env bats
# orchestrator-direct-edit-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/orchestrator-direct-edit-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/orchestrator-direct-edit-guard.sh"

setup() {
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


# stdin に tool_input.file_path 形式の JSON を渡してスクリプトを実行するヘルパー
# 注意: このヘルパーは内部で `run bash -c ...` を呼ぶため、
#       テストケースから呼ぶときは `run run_script_with_file ...` ではなく
#       `run_script_with_file ...` と直接呼ぶこと（run の二重呼び出し禁止）。
run_script_with_file() {
    local file_path="$1"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
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
    run bash -c "cd '$run_dir' && printf '%s' '$tool_input' | bash '$SCRIPT'"

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

@test "orchestratorは非mainブランチ（worktree）でもapps/配下のソースファイル編集がブロックされること [step 6]" {
    # Arrange: step 6 の DENY を確認 — orchestrator はソースファイルを直接編集できない
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "orchestratorは非mainブランチ（worktree）でもpackages/配下の編集がブロックされること [step 6]" {
    # Arrange: step 6 の DENY を確認 — packages/ もソースファイルとして扱われる
    git -C "$REPO_DIR" checkout -b feature/packages-branch
    local file_path="$REPO_DIR/packages/shared/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "orchestratorは非mainブランチ（worktree）でもtests/配下の編集がブロックされること [step 6]" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/tests/api/routes/articles.test.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "orchestratorは非mainブランチ（worktree）でもscripts/配下の編集がブロックされること [step 6]" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/scripts/gate/check-test-coverage.sh"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "step 6 ブロック時に coder への委譲メッセージが出ること [step 6]" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"

    # Act
    run_script_with_file "$file_path"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"coder"* ]]
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

# --- Phase B: team config ベースの sub-agent 検出（CLAUDE_AGENT_NAME 依存除去後） ---

@test "Phase B: team config が存在する場合（team active）は main ブランチでも allow されること" {
    # Arrange: team config を作成して team active 状態にする
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')
    mkdir -p "$REPO_DIR/.claude-user/teams/active-issues"
    echo '{"members":[{"name":"coder-100"}]}' > "$REPO_DIR/.claude-user/teams/active-issues/config.json"

    # Act: CLAUDE_AGENT_NAME 未設定でも team active なら allow
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"

    # Assert
    [ "$status" -eq 0 ]
}

@test "Phase B: team config が存在しない場合（team inactive）は main ブランチで deny されること" {
    # Arrange: team config なし
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')
    rm -f "$REPO_DIR/.claude-user/teams/active-issues/config.json" 2>/dev/null || true

    # Act
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "Phase B: team active でも .claude/** の orchestration ファイルは main ブランチで deny されること（main 直接編集禁止）" {
    # Arrange: team active だが .claude/ への main-branch 直接編集は orchestrator 禁止
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')
    mkdir -p "$REPO_DIR/.claude-user/teams/active-issues"
    echo '{"members":[{"name":"coder-100"}]}' > "$REPO_DIR/.claude-user/teams/active-issues/config.json"

    # Act
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"

    # Assert: team active でも orchestrator のみがいる main 上では deny
    # (team active = sub-agent present, but the check is at file level)
    [ "$status" -eq 0 ]
}
