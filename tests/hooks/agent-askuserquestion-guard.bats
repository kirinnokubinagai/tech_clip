#!/usr/bin/env bats
# agent-askuserquestion-guard.sh の PreToolUse:AskUserQuestion hook テスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/agent-askuserquestion-guard.bats

HOOK="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/agent-askuserquestion-guard.sh"

setup() {
    TMPDIR="$BATS_TEST_TMPDIR"
    export HOME="$TMPDIR/home"
    mkdir -p "$HOME"
    unset CLAUDE_AGENT_NAME
}



run_hook() {
    local json="${1:-{}}"
    echo "$json" | bash "$HOOK"
}

# -------------------------------------------------------------------------
# C-2a: AskUserQuestion orchestrator 専属ガードテスト
# -------------------------------------------------------------------------

@test "CLAUDE_AGENT_NAME 未設定 (orchestrator) は AskUserQuestion を許可されること" {
    unset CLAUDE_AGENT_NAME
    run run_hook '{}'
    [ "$status" -eq 0 ]
}

@test "coder-1 からの AskUserQuestion は DENY されること" {
    export CLAUDE_AGENT_NAME="coder-1"
    run run_hook '{}'
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "reviewer-1 からの AskUserQuestion は DENY されること" {
    export CLAUDE_AGENT_NAME="reviewer-1"
    run run_hook '{}'
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "team-lead (CLAUDE_AGENT_NAME=team-lead) は AskUserQuestion を許可されること" {
    export CLAUDE_AGENT_NAME="team-lead"
    run run_hook '{}'
    [ "$status" -eq 0 ]
}
