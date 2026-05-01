#!/usr/bin/env bats
# spawn-prepare.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/scripts/skills/spawn-prepare.bats

REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/skills/spawn-prepare.sh"

setup() {
    BIN_STUB="$BATS_TEST_TMPDIR/bin"
    mkdir -p "$BIN_STUB"

    # gh stub
    cat > "$BIN_STUB/gh" << 'GHEOF'
#!/usr/bin/env bash
if [[ "$*" == *"issue view"* ]]; then
    LABELS="${GH_STUB_LABELS:-[]}"
    printf '{"title":"test issue","body":"test body","labels":%s}\n' "$LABELS"
fi
GHEOF
    chmod +x "$BIN_STUB/gh"

    export PATH="$BIN_STUB:$PATH"
    export GH_STUB_LABELS='[]'

    # issue-1234 worktree が必要（script が cd して pwd -P するため）
    mkdir -p "$REPO_ROOT/../issue-1234" 2>/dev/null || true
}

# spawn-prepare.sh を実行して JSON 出力を返す
call_spawn_prepare() {
    local issue="$1" labels="${GH_STUB_LABELS:-[]}"
    export GH_STUB_LABELS="$labels"
    bash "$SCRIPT" "$issue" "test-naming" 2>/dev/null
}

# -------------------------------------------------------------------------
# 新形式エージェント名テスト
# -------------------------------------------------------------------------

@test "Issue 1234 (label なし) → agents[0].name == analyst-1234" {
    GH_STUB_LABELS='[]' result=$(call_spawn_prepare "1234")
    name=$(echo "$result" | jq -r '.agents[0].name')
    [ "$name" = "analyst-1234" ]
}

@test "Issue 1234 (label なし) → agents[1].name == coder-1234" {
    GH_STUB_LABELS='[]' result=$(call_spawn_prepare "1234")
    name=$(echo "$result" | jq -r '.agents[1].name')
    [ "$name" = "coder-1234" ]
}

@test "Issue 1234 (label なし) → agents[2].name == e2e-reviewer-1234" {
    GH_STUB_LABELS='[]' result=$(call_spawn_prepare "1234")
    name=$(echo "$result" | jq -r '.agents[2].name')
    [ "$name" = "e2e-reviewer-1234" ]
}

@test "Issue 1234 (label なし) → agents[3].name == reviewer-1234" {
    GH_STUB_LABELS='[]' result=$(call_spawn_prepare "1234")
    name=$(echo "$result" | jq -r '.agents[3].name')
    [ "$name" = "reviewer-1234" ]
}

@test "infra ラベル → agents[1].name == infra-engineer-1234, agents[3].name == infra-reviewer-1234" {
    GH_STUB_LABELS='[{"name":"infra"}]' result=$(call_spawn_prepare "1234")
    impl=$(echo "$result" | jq -r '.agents[1].name')
    reviewer=$(echo "$result" | jq -r '.agents[3].name')
    [ "$impl" = "infra-engineer-1234" ]
    [ "$reviewer" = "infra-reviewer-1234" ]
}

@test "ui ラベル → agents[1].name == ui-designer-1234, agents[3].name == ui-reviewer-1234" {
    GH_STUB_LABELS='[{"name":"ui"}]' result=$(call_spawn_prepare "1234")
    impl=$(echo "$result" | jq -r '.agents[1].name')
    reviewer=$(echo "$result" | jq -r '.agents[3].name')
    [ "$impl" = "ui-designer-1234" ]
    [ "$reviewer" = "ui-reviewer-1234" ]
}

@test "旧形式 issue-{N}-analyst は agents[] に含まれないこと" {
    GH_STUB_LABELS='[]' result=$(call_spawn_prepare "1234")
    count=$(echo "$result" | jq '[.agents[].name | select(startswith("issue-"))] | length')
    [ "$count" = "0" ]
}
