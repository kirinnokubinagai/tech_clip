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

# --- サブエージェント pass-through (priority 0) ---

@test "CLAUDE_AGENT_NAME が設定されたサブエージェントはmainブランチのapps/配下も許可されること [Phase 0]" {
    # Arrange: mainブランチ上でサブエージェント名を設定
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act: CLAUDE_AGENT_NAME をエクスポートしてスクリプト実行
    export CLAUDE_AGENT_NAME="issue-100-coder"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert: サブエージェントなら即 exit 0
    [ "$status" -eq 0 ]
}

@test "CLAUDE_AGENT_NAME が設定されたサブエージェント(reviewer以外)はmainブランチの.claude/配下も許可されること [Phase 0]" {
    # Arrange
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-coder"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

@test "_CLAUDE_DETECTED_AGENT_NAME が設定されたサブエージェントはmainブランチのソースファイルも許可されること [Phase 0]" {
    # Arrange: テスト用の注入変数でサブエージェントをシミュレート
    local file_path="$REPO_DIR/apps/mobile/src/App.tsx"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    unset CLAUDE_AGENT_NAME
    export _CLAUDE_DETECTED_AGENT_NAME="issue-200-infra-engineer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset _CLAUDE_DETECTED_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

@test "_CLAUDE_DETECTED_AGENT_NAME が設定されたサブエージェントはdetached HEAD状態でも許可されること [Phase 0]" {
    # Arrange: detached HEAD でもサブエージェントはブロックされない
    local commit_hash
    commit_hash=$(git -C "$REPO_DIR" rev-parse HEAD)
    git -C "$REPO_DIR" checkout --detach "$commit_hash"
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    unset CLAUDE_AGENT_NAME
    export _CLAUDE_DETECTED_AGENT_NAME="issue-300-ui-designer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset _CLAUDE_DETECTED_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

@test "オーケストレーター（両変数未設定）はmainブランチでブロックされること [Phase 0]" {
    # Arrange: CLAUDE_AGENT_NAME・_CLAUDE_DETECTED_AGENT_NAME 両方未設定 = orchestrator
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"

    # Assert: orchestrator は mainブランチでブロックされる
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test ".omc/state/配下はサブエージェント（CLAUDE_AGENT_NAME設定）でも pass-through されること [Phase 0]" {
    # NOTE: サブエージェント check は priority 0 = 最初に exit 0 するので .omc/state/ check より先に終わる
    # サブエージェントは .omc/state/ 編集も許可（is_blocked_file は orchestrator 専用ガード）
    local file_path="$REPO_DIR/.omc/state/autopilot-state.json"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-coder"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert: サブエージェントは priority 0 で即 exit 0（.omc/state/ check より先）
    [ "$status" -eq 0 ]
}

# --- reviewer 系ブロックテスト ---

@test "reviewer エージェントは非mainブランチのソースファイル編集がブロックされること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
    [[ "${output}" == *"reviewer"* ]]
}

@test "infra-reviewer エージェントはソースファイル編集がブロックされること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-infra-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "ui-reviewer エージェントはソースファイル編集がブロックされること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-ui-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "reviewer エージェントは .claude/hooks/ 編集もブロックされること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "reviewer エージェントは .claude/.review-passed 編集もブロックされること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/.claude/.review-passed"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"DENY"* ]]
}

@test "reviewer のブロックメッセージに代替手段が表示されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 2 ]
    [[ "${output}" == *"create-review-marker.sh"* ]]
    [[ "${output}" == *"push-verified.sh"* ]]
}

# --- e2e-reviewer 非ブロックテスト ---

@test "e2e-reviewer エージェントはソースファイル編集が許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-e2e-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

@test "e2e-reviewer エージェントは .claude/ 配下編集が許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/.claude/hooks/some-hook.sh"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-e2e-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

# --- reviewer メタファイル例外テスト ---

@test "reviewer エージェントは .claude-user/ 配下の編集が許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/.claude-user/memory/some-memory.md"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

@test "reviewer エージェントは .omc/ 配下の編集が許可されること" {
    # Arrange
    git -C "$REPO_DIR" checkout -b feature/test-branch
    local file_path="$REPO_DIR/.omc/notepad.md"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

# --- coder 等の非 reviewer サブエージェントの非ブロック確認 ---

@test "coder エージェントは引き続きソースファイル編集が許可されること" {
    # Arrange（reviewer 変更後の regression 確認）
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-coder"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}

@test "analyst エージェントは引き続きソースファイル編集が許可されること" {
    # Arrange
    local file_path="$REPO_DIR/apps/api/src/index.ts"
    local input
    input=$(jq -n --arg p "$file_path" '{"tool_input":{"file_path":$p}}')

    # Act
    export CLAUDE_AGENT_NAME="issue-100-analyst"
    run bash -c "cd '$REPO_DIR' && printf '%s' '$input' | bash '$SCRIPT'"
    unset CLAUDE_AGENT_NAME

    # Assert
    [ "$status" -eq 0 ]
}
