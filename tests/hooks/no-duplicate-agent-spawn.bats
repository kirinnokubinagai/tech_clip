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
# C-4a: 数値サフィックスエージェント名ブロックテスト ({role}-{N} 形式)
# -------------------------------------------------------------------------

@test "reviewer-999-2 は数値サフィックスのため BLOCK されること" {
    local json='{"tool_input":{"name":"reviewer-999-2","subagent_type":"reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "coder-1056-3 は数値サフィックスのため BLOCK されること" {
    local json='{"tool_input":{"name":"coder-1056-3","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "coder-999 はアルファベット lane のため許可されること (suffix なし)" {
    local json='{"tool_input":{"name":"coder-999","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "coder-flatten-999 はアルファベット lane のため許可されること" {
    local json='{"tool_input":{"name":"coder-flatten-999","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "infra-engineer-mobile-999 はアルファベット lane のため許可されること" {
    local json='{"tool_input":{"name":"infra-engineer-mobile-999","subagent_type":"infra-engineer"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# .tool_input.name パス確認テスト（旧 .name パスでは検出されないことを確認）
# -------------------------------------------------------------------------

@test "tool_input.name パスで数値サフィックスが正しく検出されること" {
    # .tool_input.name に名前が入っている場合のみ BLOCK されることを確認
    local json='{"tool_input":{"name":"coder-100-2"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "tool_input なしのフラット JSON では名前がない扱いで許可されること" {
    # 旧フォーマット（.name）では名前が取得できず exit 0 になること
    local json='{"name":"coder-100-2","subagent_type":"coder"}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "空の JSON では exit 0 になること" {
    run run_hook '{}'
    [ "$status" -eq 0 ]
}

@test "e2e-reviewer-999-2 は数値サフィックスのため BLOCK されること" {
    local json='{"tool_input":{"name":"e2e-reviewer-999-2","subagent_type":"e2e-reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}
