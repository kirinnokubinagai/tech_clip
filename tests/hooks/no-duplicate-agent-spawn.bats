#!/usr/bin/env bats
# no-duplicate-agent-spawn.sh の PreToolUse:Agent hook テスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/no-duplicate-agent-spawn.bats

HOOK="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/no-duplicate-agent-spawn.sh"

setup() {
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/repo"
    mkdir -p "$REPO_DIR"
}



run_hook() {
    local json="$1"
    (cd "$REPO_DIR" && echo "$json" | bash "$HOOK")
}

# -------------------------------------------------------------------------
# C-4a: 数値サフィックスエージェント名ブロックテスト
# -------------------------------------------------------------------------

@test "issue-999-reviewer-2 は数値サフィックスのため BLOCK されること" {
    local json='{"tool_input":{"name":"issue-999-reviewer-2","subagent_type":"reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "issue-1056-coder-3 は数値サフィックスのため BLOCK されること" {
    local json='{"tool_input":{"name":"issue-1056-coder-3","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "issue-999-coder-api はアルファベット lane のため許可されること" {
    local json='{"tool_input":{"name":"issue-999-coder-api","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "issue-999-infra-engineer-mobile はアルファベット lane のため許可されること" {
    local json='{"tool_input":{"name":"issue-999-infra-engineer-mobile","subagent_type":"infra-engineer"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# .tool_input.name パス確認テスト（旧 .name パスでは検出されないことを確認）
# -------------------------------------------------------------------------

@test "tool_input.name パスで数値サフィックスが正しく検出されること" {
    # .tool_input.name に名前が入っている場合のみ BLOCK されることを確認
    local json='{"tool_input":{"name":"issue-100-coder-2"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "tool_input なしのフラット JSON では名前がない扱いで許可されること" {
    # 旧フォーマット（.name）では名前が取得できず exit 0 になること
    local json='{"name":"issue-100-coder-2","subagent_type":"coder"}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "空の JSON では exit 0 になること" {
    run run_hook '{}'
    [ "$status" -eq 0 ]
}

@test "issue-999-e2e-reviewer-2 は数値サフィックスのため BLOCK されること" {
    local json='{"tool_input":{"name":"issue-999-e2e-reviewer-2","subagent_type":"e2e-reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}
