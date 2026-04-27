#!/usr/bin/env bats
# no-duplicate-agent-spawn.sh の PreToolUse:Agent hook テスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/no-duplicate-agent-spawn.bats

HOOK="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/no-duplicate-agent-spawn.sh"

setup() {
    TMPDIR=$(mktemp -d)
    REPO_DIR="$TMPDIR/repo"
    mkdir -p "$REPO_DIR"
    git -C "$REPO_DIR" init -b main
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "init" > "$REPO_DIR/README.md"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "init"

    TEAM_CONFIG="$REPO_DIR/.claude-user/teams/active-issues/config.json"
    mkdir -p "$(dirname "$TEAM_CONFIG")"
    echo '{"members":[]}' > "$TEAM_CONFIG"
}

teardown() {
    rm -rf "$TMPDIR"
}

run_hook() {
    local json="$1"
    (cd "$REPO_DIR" && echo "$json" | bash "$HOOK")
}

# -------------------------------------------------------------------------
# C-4a: 数値サフィックスエージェント名ブロックテスト
# -------------------------------------------------------------------------

@test "issue-999-reviewer-2 は数値サフィックスのため BLOCK されること" {
    local json='{"name":"issue-999-reviewer-2","subagent_type":"reviewer","team_name":"active-issues"}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "issue-1056-coder-3 は数値サフィックスのため BLOCK されること" {
    local json='{"name":"issue-1056-coder-3","subagent_type":"coder","team_name":"active-issues"}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "issue-999-coder-api はアルファベット lane のため許可されること" {
    local json='{"name":"issue-999-coder-api","subagent_type":"coder","team_name":"active-issues"}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "issue-999-infra-engineer-mobile はアルファベット lane のため許可されること" {
    local json='{"name":"issue-999-infra-engineer-mobile","subagent_type":"infra-engineer","team_name":"active-issues"}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}
