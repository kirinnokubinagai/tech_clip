#!/usr/bin/env bats
# orchestrator-flow-guard.sh の PreToolUse hook テスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/orchestrator-flow-guard.bats

HOOK="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/orchestrator-flow-guard.sh"

setup() {
    TMPDIR=$(mktemp -d)
    export HOME="$TMPDIR/home"
    mkdir -p "$HOME"
    # デフォルトでメンバー空の team config を作成（analyst 省略チェックを有効化）
    mkdir -p "$HOME/.claude-user/teams/active-issues"
    echo '{"members":[]}' > "$HOME/.claude-user/teams/active-issues/config.json"
}

teardown() {
    rm -rf "$TMPDIR"
}

# hook に JSON を渡して実行するヘルパー
run_hook() {
    local json="$1"
    echo "$json" | bash "$HOOK"
}

# -------------------------------------------------------------------------
# Agent tool: analyst 省略検知テスト
# -------------------------------------------------------------------------

@test "analyst なしで coder spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-coder","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst なしで infra-engineer spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-infra-engineer","subagent_type":"infra-engineer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst なしで reviewer spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-reviewer","subagent_type":"reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst なしで ui-designer spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-ui-designer","subagent_type":"ui-designer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst なしで infra-reviewer spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-infra-reviewer","subagent_type":"infra-reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst なしで ui-reviewer spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-ui-reviewer","subagent_type":"ui-reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst が存在する場合は coder spawn が許可されること" {
    # team config に analyst を追加
    echo '{"members":[{"name":"issue-100-analyst"},{"name":"issue-100-coder"}]}' \
        > "$HOME/.claude-user/teams/active-issues/config.json"
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-100-coder","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "analyst spawn 自体はブロックされないこと" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-analyst","subagent_type":"analyst"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "無関係な agent name はブロックされないこと" {
    local json='{"tool_name":"Agent","tool_input":{"name":"some-other-agent","subagent_type":"executor"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "team config が存在しない場合は spawn が許可されること" {
    rm -f "$HOME/.claude-user/teams/active-issues/config.json"
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-coder","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# Bash tool: gh issue close ガードテスト
# -------------------------------------------------------------------------

@test "AskUserQuestion なしの gh issue close はブロックされること" {
    local json='{"tool_name":"Bash","tool_input":{"command":"gh issue close 123"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "AskUserQuestion フラグがある場合は gh issue close が許可されること" {
    mkdir -p "$HOME/.claude-user/projects/test-project/memory"
    date -u +%Y-%m-%dT%H:%M:%SZ > "$HOME/.claude-user/projects/test-project/memory/tmp-last-askuserquestion.flag"
    local json='{"tool_name":"Bash","tool_input":{"command":"gh issue close 123"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "期限切れの AskUserQuestion フラグは gh issue close をブロックすること" {
    mkdir -p "$HOME/.claude-user/projects/test-project/memory"
    echo "2000-01-01T00:00:00Z" > "$HOME/.claude-user/projects/test-project/memory/tmp-last-askuserquestion.flag"
    local json='{"tool_name":"Bash","tool_input":{"command":"gh issue close 123"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "gh issue list はブロックされないこと" {
    local json='{"tool_name":"Bash","tool_input":{"command":"gh issue list --state open"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# Bash tool: gh pr merge ガードテスト
# -------------------------------------------------------------------------

@test "CLAUDE_AGENT_NAME 未設定の gh pr merge はブロックされること" {
    unset CLAUDE_AGENT_NAME
    local json='{"tool_name":"Bash","tool_input":{"command":"gh pr merge 456 --auto --merge"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "coder からの gh pr merge はブロックされること" {
    export CLAUDE_AGENT_NAME="issue-100-coder"
    local json='{"tool_name":"Bash","tool_input":{"command":"gh pr merge 456 --auto --merge"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "reviewer からの gh pr merge は許可されること" {
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    local json='{"tool_name":"Bash","tool_input":{"command":"gh pr merge 456 --auto --merge"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "infra-reviewer からの gh pr merge は許可されること" {
    export CLAUDE_AGENT_NAME="issue-100-infra-reviewer"
    local json='{"tool_name":"Bash","tool_input":{"command":"gh pr merge 456 --auto --merge"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "ui-reviewer からの gh pr merge は許可されること" {
    export CLAUDE_AGENT_NAME="issue-100-ui-reviewer"
    local json='{"tool_name":"Bash","tool_input":{"command":"gh pr merge 456 --auto --merge"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# Bash tool: force push ガードテスト
# -------------------------------------------------------------------------

@test "git push -f はブロックされること" {
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD -f"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "git push --force はブロックされること" {
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD --force"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "通常の git push はブロックされないこと" {
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "bash scripts/push-verified.sh はブロックされないこと" {
    local json='{"tool_name":"Bash","tool_input":{"command":"bash scripts/push-verified.sh"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# その他のツールはブロックされないこと
# -------------------------------------------------------------------------

@test "Read ツールはブロックされないこと" {
    local json='{"tool_name":"Read","tool_input":{"file_path":"/tmp/test.txt"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "Write ツールはブロックされないこと" {
    local json='{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.txt","content":"test"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}
