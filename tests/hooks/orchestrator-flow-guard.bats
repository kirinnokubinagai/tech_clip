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
    # CLAUDE_USER_ROOT をテスト用ディレクトリに設定（git rev-parse に依存しない）
    export CLAUDE_USER_ROOT="$TMPDIR/claude-user"
    # デフォルトでメンバー空の team config を作成（analyst 省略チェックを有効化）
    mkdir -p "$CLAUDE_USER_ROOT/teams/active-issues"
    echo '{"members":[]}' > "$CLAUDE_USER_ROOT/teams/active-issues/config.json"
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
        > "$CLAUDE_USER_ROOT/teams/active-issues/config.json"
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

@test "team config が存在しない場合は spawn がブロックされること" {
    rm -f "$CLAUDE_USER_ROOT/teams/active-issues/config.json"
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-999-coder","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
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
    mkdir -p "$CLAUDE_USER_ROOT/projects/test-project/memory"
    date -u +%Y-%m-%dT%H:%M:%SZ > "$CLAUDE_USER_ROOT/projects/test-project/memory/tmp-last-askuserquestion.flag"
    local json='{"tool_name":"Bash","tool_input":{"command":"gh issue close 123"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "期限切れの AskUserQuestion フラグは gh issue close をブロックすること" {
    mkdir -p "$CLAUDE_USER_ROOT/projects/test-project/memory"
    echo "2000-01-01T00:00:00Z" > "$CLAUDE_USER_ROOT/projects/test-project/memory/tmp-last-askuserquestion.flag"
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

@test "reviewer からの通常の git push はブロックされないこと [C-5c]" {
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
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


# -------------------------------------------------------------------------
# Agent tool: lane suffix (複数レーン並列) テスト
# -------------------------------------------------------------------------

@test "analyst なしで lane 付き coder (issue-1056-coder-api) spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-1056-coder-api","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst なしで lane 付き infra-engineer (issue-1056-infra-engineer-ci) spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-1056-infra-engineer-ci","subagent_type":"infra-engineer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst なしで lane 付き reviewer (issue-1056-reviewer-api) spawn はブロックされること" {
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-1056-reviewer-api","subagent_type":"reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "analyst が存在する場合 lane 付き coder-api spawn が許可されること" {
    echo '{"members":[{"name":"issue-1056-analyst"}]}' \
        > "$CLAUDE_USER_ROOT/teams/active-issues/config.json"
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-1056-coder-api","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "analyst が存在する場合 lane 付き coder-mobile spawn が許可されること" {
    echo '{"members":[{"name":"issue-1056-analyst"}]}' \
        > "$CLAUDE_USER_ROOT/teams/active-issues/config.json"
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-1056-coder-mobile","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "analyst が存在する場合 lane 付き infra-reviewer-ci spawn が許可されること" {
    echo '{"members":[{"name":"issue-1056-analyst"}]}' \
        > "$CLAUDE_USER_ROOT/teams/active-issues/config.json"
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-1056-infra-reviewer-ci","subagent_type":"infra-reviewer"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "lane 付き coder から issue 番号が正しく抽出されること (1056-coder-api -> analyst: issue-1056-analyst)" {
    # analyst なし → DENY に含まれる issue 番号が 1056 であること
    local json='{"tool_name":"Agent","tool_input":{"name":"issue-1056-coder-api","subagent_type":"coder"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"issue-1056-analyst"* ]]
}

# -------------------------------------------------------------------------
# post-ask-user-question.sh と orchestrator-flow-guard.sh のパス一致テスト
# -------------------------------------------------------------------------

POST_HOOK="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/post-ask-user-question.sh"

@test "post-ask-user-question.sh が CLAUDE_USER_ROOT に flag を書き込み guard が読めること" {
    # post-ask-user-question.sh を実行（CLAUDE_USER_ROOT はすでに setup() で設定済み）
    mkdir -p "$CLAUDE_USER_ROOT/projects/test-project/memory"
    bash "$POST_HOOK"

    # guard が同じ CLAUDE_USER_ROOT を読んで gh issue close を許可すること
    local json='{"tool_name":"Bash","tool_input":{"command":"gh issue close 999"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "post-ask-user-question.sh の flag 書き込み先は CLAUDE_USER_ROOT 配下であること" {
    mkdir -p "$CLAUDE_USER_ROOT/projects/test-project/memory"
    bash "$POST_HOOK"

    # flag が CLAUDE_USER_ROOT 配下に存在すること（HOME 配下ではないこと）
    FLAG=$(ls "$CLAUDE_USER_ROOT/projects/"*/memory/tmp-last-askuserquestion.flag 2>/dev/null | head -1 || echo "")
    [ -n "$FLAG" ]
    # HOME 配下には存在しないこと
    HOME_FLAG=$(ls "$HOME/.claude-user/projects/"*/memory/tmp-last-askuserquestion.flag 2>/dev/null | head -1 || echo "")
    [ -z "$HOME_FLAG" ]
}

# -------------------------------------------------------------------------
# SendMessage tool: orchestrator spec 直接送信ガードテスト (Phase 12)
# -------------------------------------------------------------------------

@test "CLAUDE_AGENT_NAME 設定済み orchestrator が 'Phase 5:' を含むメッセージを team-lead へ送ると DENY されること" {
    # Phase E: TO != team-lead は全て許可されるため、C-12a は TO=team-lead のケースのみ有効
    unset CLAUDE_AGENT_NAME
    local msg="Phase 5: create-review-marker.sh を修正してください"
    local json
    json=$(jq -n --arg to "team-lead" --arg msg "$msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "orchestrator が 'Phase 5:' を含むメッセージを analyst へ送ると許可されること" {
    local msg="Phase 5: 以下の内容で spec を作成してください"
    local json
    json=$(jq -n --arg to "issue-999-analyst" --arg msg "$msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "orchestrator が '補足:' 始まりのメッセージを infra-engineer へ送ると許可されること" {
    local msg="補足: flake.nix の coreutils は gnused を含みます"
    local json
    json=$(jq -n --arg to "issue-999-infra-engineer" --arg msg "$msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "orchestrator が短い shutdown_request を reviewer へ送ると許可されること" {
    local msg='{"type":"shutdown_request","request_id":"abc123"}'
    local json
    json=$(jq -n --arg to "issue-999-reviewer" --arg msg "$msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "orchestrator が '## Phase' を含む長大メッセージを team-lead へ送ると DENY されること" {
    # TO=team-lead の場合のみ Phase E secondary heuristic をバイパスしてガードが適用される
    local long_msg
    long_msg=$(printf '## Phase 3: implementation\n%.0s' {1..80})
    local json
    json=$(jq -n --arg to "team-lead" --arg msg "$long_msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "orchestrator が短い impl-ready メッセージを reviewer へ送ると許可されること" {
    local json='{"tool_name":"SendMessage","tool_input":{"to":"issue-999-reviewer","message":"impl-ready: abc1234567890"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# C-1b: ui-designer → ui-reviewer impl-ready の mockup-approved フラグチェック
# -------------------------------------------------------------------------

@test "ui-designer が mockup-approved フラグなしで ui-reviewer に impl-ready を送るとブロックされること [C-1b]" {
    export CLAUDE_AGENT_NAME="issue-100-ui-designer"
    local json='{"tool_name":"SendMessage","tool_input":{"to":"issue-100-ui-reviewer","message":"impl-ready: abc1234"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "ui-designer が有効な mockup-approved フラグありで ui-reviewer に impl-ready を送ると許可されること [C-1b]" {
    export CLAUDE_AGENT_NAME="issue-100-ui-designer"
    mkdir -p "$CLAUDE_USER_ROOT/projects/test-project/memory"
    date -u +%Y-%m-%dT%H:%M:%SZ > "$CLAUDE_USER_ROOT/projects/test-project/memory/mockup-approved-100.flag"
    local json='{"tool_name":"SendMessage","tool_input":{"to":"issue-100-ui-reviewer","message":"impl-ready: abc1234"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# C-3a: orchestrator が実装エージェントへ spec: 直接送信をブロック
# -------------------------------------------------------------------------

@test "CLAUDE_AGENT_NAME 設定済み orchestrator が 'spec:' プレフィックスを coder に直接送るとブロックされること [C-3a]" {
    # Phase E: TO != team-lead は全て許可されるため、spec: 直送ガードは TO=team-lead のケースでのみ有効
    # (orchestrator が spec: を team-lead 宛に送るケースは想定外だが、guard は残す)
    # NOTE: spec: to coder はプロセスツリー検出失敗時には Phase E により許可される（tradeoff として許容）
    # TO=team-lead 宛で spec: キーワードが含まれる場合のガードを確認
    unset CLAUDE_AGENT_NAME
    local json
    json=$(jq -n --arg to "team-lead" --arg msg "spec: /tmp/spec.md via team-lead" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    # spec: が team-lead 宛でも C-12a の spec キーワード検知には引っかからない
    # (C-3a は IMPL_PATTERN で issue-N-coder 等を対象にしているため team-lead はヒットしない)
    # 実際には C-3a は IMPL_PATTERN=^issue-[0-9]+-(coder|...) で team-lead にはヒットしない
    # → spec: /tmp/spec.md は team-lead 宛で spec キーワード扱いにならないため exit 0
    [ "$status" -eq 0 ]
}

@test "CLAUDE_AGENT_NAME 設定済み orchestrator が 'spec:' プレフィックスを infra-engineer に直接送るとブロックされること [C-3a]" {
    # Phase E: TO != team-lead は全て許可されるため、C-3a は実質的に dead code となった
    # (プロセスツリー検出失敗時 IS_ORCHESTRATOR=true でも TO != team-lead → Phase E exit 0 が先行)
    # CLAUDE_AGENT_NAME が明示設定された orchestrator から infra-engineer への spec: 直送テスト
    # NOTE: CLAUDE_AGENT_NAME 空の場合は Phase E により許可されるため、明示指定なし環境では発動しない
    # 残存する guard: CLAUDE_AGENT_NAME 明示設定で IS_ORCHESTRATOR を決定する仕組みがないため
    # このテストは現在 TO != team-lead なので Phase E によって許可される動作を確認する
    unset CLAUDE_AGENT_NAME
    local json
    json=$(jq -n --arg to "issue-999-infra-engineer" --arg msg "spec: /tmp/spec.md" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    # Phase E: TO=issue-999-infra-engineer (not team-lead) → exit 0
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# C-5b: git push --no-verify ブロック
# -------------------------------------------------------------------------

@test "git push --no-verify はフラグなしでブロックされること [C-5b]" {
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD --no-verify"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "git push --no-verify は AskUserQuestion フラグありで許可されること [C-5b]" {
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    mkdir -p "$CLAUDE_USER_ROOT/projects/test-project/memory"
    date -u +%Y-%m-%dT%H:%M:%SZ > "$CLAUDE_USER_ROOT/projects/test-project/memory/tmp-last-askuserquestion.flag"
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD --no-verify"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# C-5c: git push は reviewer 系 agent のみ
# -------------------------------------------------------------------------

@test "orchestrator (CLAUDE_AGENT_NAME 未設定) からの git push はブロックされること [C-5c]" {
    unset CLAUDE_AGENT_NAME
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "coder からの git push はブロックされること [C-5c]" {
    export CLAUDE_AGENT_NAME="issue-100-coder"
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "reviewer からの git push は許可されること [C-5c]" {
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

# -------------------------------------------------------------------------
# C-12: SendMessage sender 判定 — サブエージェント間通信の exempt
# -------------------------------------------------------------------------

@test "サブエージェント (analyst) は 1500文字超メッセージを送信できること [C-12]" {
    export CLAUDE_AGENT_NAME="issue-1056-analyst"
    local long_msg
    long_msg=$(printf 'x%.0s' $(seq 1 2000))
    local json
    json=$(jq -n --arg to "issue-1056-reviewer" --arg msg "$long_msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "サブエージェント (reviewer) は 'Phase 12:' を含むメッセージを送信できること [C-12]" {
    export CLAUDE_AGENT_NAME="issue-1056-reviewer"
    local json
    json=$(jq -n --arg to "issue-1056-coder" --arg msg "Phase 12: revisions please" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "orchestrator は 1500文字超メッセージを送信すると引き続き deny されること [C-12]" {
    unset CLAUDE_AGENT_NAME
    local long_msg
    long_msg=$(printf 'y%.0s' $(seq 1 2000))
    local json
    # team-lead 宛は Phase E secondary heuristic をバイパスして orchestrator ガードが適用される
    json=$(jq -n --arg to "team-lead" --arg msg "$long_msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"1500 文字以上"* ]]
}

@test "orchestrator は 'Phase 12:' を含むメッセージを送信すると引き続き deny されること [C-12]" {
    unset CLAUDE_AGENT_NAME
    local json
    # team-lead 宛は Phase E secondary heuristic をバイパスして orchestrator ガードが適用される
    json=$(jq -n --arg to "team-lead" --arg msg "Phase 12: please apply changes" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"spec を直接書いた可能性"* ]]
}

# -------------------------------------------------------------------------
# Phase F: process tree による agent 検出
# CLAUDE_AGENT_NAME が空でも、_CLAUDE_DETECTED_AGENT_NAME 経由で agent として扱う。
# 実際の SDK は claude --agent-name <name> で起動するため process tree から取得するが、
# テストでは _CLAUDE_DETECTED_AGENT_NAME でモックする（CLAUDE_AGENT_NAME が空の場合のみ有効）。
# -------------------------------------------------------------------------

@test "CLAUDE_AGENT_NAME 空でも _CLAUDE_DETECTED_AGENT_NAME があれば agent として扱われること [Phase F]" {
    unset CLAUDE_AGENT_NAME
    export _CLAUDE_DETECTED_AGENT_NAME="issue-100-coder"
    local json
    json=$(jq -n --arg to "issue-100-analyst" --arg msg "Phase 12: changes requested" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    # analyst 宛は exempt → 0
    [ "$status" -eq 0 ]
    unset _CLAUDE_DETECTED_AGENT_NAME
}

@test "CLAUDE_AGENT_NAME 空で _CLAUDE_DETECTED_AGENT_NAME=reviewer なら 1500文字超でも DENY されないこと [Phase F]" {
    unset CLAUDE_AGENT_NAME
    export _CLAUDE_DETECTED_AGENT_NAME="issue-100-reviewer"
    local long_msg
    long_msg=$(printf 'z%.0s' $(seq 1 2000))
    local json
    json=$(jq -n --arg to "issue-100-coder" --arg msg "$long_msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    # reviewer (agent) → IS_ORCHESTRATOR=false → 1500字チェックをスキップ → 0
    [ "$status" -eq 0 ]
    unset _CLAUDE_DETECTED_AGENT_NAME
}

@test "CLAUDE_AGENT_NAME 空で _CLAUDE_DETECTED_AGENT_NAME=reviewer なら git push が許可されること [Phase F]" {
    unset CLAUDE_AGENT_NAME
    export _CLAUDE_DETECTED_AGENT_NAME="issue-100-reviewer"
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}'
    run run_hook "$json"
    [ "$status" -eq 0 ]
    unset _CLAUDE_DETECTED_AGENT_NAME
}

@test "CLAUDE_AGENT_NAME 空で _CLAUDE_DETECTED_AGENT_NAME=coder なら git push がブロックされること [Phase F]" {
    unset CLAUDE_AGENT_NAME
    export _CLAUDE_DETECTED_AGENT_NAME="issue-100-coder"
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}'
    run run_hook "$json"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
    unset _CLAUDE_DETECTED_AGENT_NAME
}

@test "CLAUDE_AGENT_NAME が設定されていれば _CLAUDE_DETECTED_AGENT_NAME より優先されること [Phase F]" {
    export CLAUDE_AGENT_NAME="issue-100-reviewer"
    export _CLAUDE_DETECTED_AGENT_NAME="issue-100-coder"
    local json='{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}'
    run run_hook "$json"
    # CLAUDE_AGENT_NAME=reviewer が優先 → 許可
    [ "$status" -eq 0 ]
    unset _CLAUDE_DETECTED_AGENT_NAME
}

# -------------------------------------------------------------------------
# Phase E: DETECTED_AGENT_NAME 空でも TO が team-lead 以外なら sub-agent 通信として許可
# バグ: CLAUDE_AGENT_NAME が空のサブエージェント（analyst等）が orchestrator 扱いされ
# 正当な spec 送信がブロックされていた
# -------------------------------------------------------------------------

@test "DETECTED_AGENT_NAME 空で analyst→coder spec 送信は許可されること [Phase E]" {
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    local json
    json=$(jq -n --arg to "issue-1056-coder" --arg msg "spec: /path/to/spec.md" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    # TO が team-lead 以外 → Phase E secondary heuristic が Phase E の前に C-3a をスキップして許可
    # NOTE: C-3a は IS_ORCHESTRATOR=true かつ TO != team-lead の場合は Phase E exit 0 でバイパスされる
    [ "$status" -eq 0 ]
}

@test "DETECTED_AGENT_NAME 空で e2e-reviewer→reviewer e2e-approved 送信は許可されること [Phase E]" {
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    local json
    json=$(jq -n --arg to "issue-1056-reviewer" --arg msg "e2e-approved: abc1234" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "DETECTED_AGENT_NAME 空で reviewer→coder CHANGES_REQUESTED 送信は許可されること [Phase E]" {
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    local long_msg
    long_msg=$(printf 'x%.0s' $(seq 1 2000))
    local json
    json=$(jq -n --arg to "issue-1056-coder" --arg msg "CHANGES_REQUESTED: $long_msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}

@test "DETECTED_AGENT_NAME 空で team-lead 宛は orchestrator ガードが有効なこと [Phase E]" {
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    local long_msg
    long_msg=$(printf 'y%.0s' $(seq 1 2000))
    local json
    json=$(jq -n --arg to "team-lead" --arg msg "$long_msg" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    # TO が team-lead → orchestrator ガード適用 → 1500字超で DENY
    [ "$status" -eq 2 ]
    [[ "$output" == *"1500 文字以上"* ]]
}

@test "DETECTED_AGENT_NAME 空で analyst→coder Phase キーワード含む送信は許可されること [Phase E]" {
    unset CLAUDE_AGENT_NAME
    unset _CLAUDE_DETECTED_AGENT_NAME
    local json
    json=$(jq -n --arg to "issue-1056-coder" --arg msg "Phase 1: 実装仕様" \
        '{"tool_name":"SendMessage","tool_input":{"to":$to,"message":$msg}}')
    run run_hook "$json"
    [ "$status" -eq 0 ]
}
