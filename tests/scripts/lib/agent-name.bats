#!/usr/bin/env bats
# agent-name.sh の parse_agent_name / build_agent_name テスト
#
# テスト環境: bats-core
# 実行: bats tests/scripts/lib/agent-name.bats

HELPER="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/lib/agent-name.sh"

# shellcheck disable=SC1090
setup() {
    source "$HELPER"
    unset AGENT_ROLE AGENT_LANE AGENT_ISSUE
}

# -------------------------------------------------------------------------
# parse_agent_name: 正常系
# -------------------------------------------------------------------------

@test "analyst-1146 → role=analyst, lane='', issue=1146" {
    parse_agent_name "analyst-1146"
    [ "$AGENT_ROLE" = "analyst" ]
    [ "$AGENT_LANE" = "" ]
    [ "$AGENT_ISSUE" = "1146" ]
}

@test "coder-1056 → role=coder, lane='', issue=1056" {
    parse_agent_name "coder-1056"
    [ "$AGENT_ROLE" = "coder" ]
    [ "$AGENT_LANE" = "" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "coder-api-1056 → role=coder, lane=api, issue=1056" {
    parse_agent_name "coder-api-1056"
    [ "$AGENT_ROLE" = "coder" ]
    [ "$AGENT_LANE" = "api" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "infra-engineer-ci-1056 → role=infra-engineer, lane=ci, issue=1056" {
    parse_agent_name "infra-engineer-ci-1056"
    [ "$AGENT_ROLE" = "infra-engineer" ]
    [ "$AGENT_LANE" = "ci" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "e2e-reviewer-1234 → role=e2e-reviewer, lane='', issue=1234" {
    parse_agent_name "e2e-reviewer-1234"
    [ "$AGENT_ROLE" = "e2e-reviewer" ]
    [ "$AGENT_LANE" = "" ]
    [ "$AGENT_ISSUE" = "1234" ]
}

@test "ui-reviewer-mobile-1234 → role=ui-reviewer, lane=mobile, issue=1234" {
    parse_agent_name "ui-reviewer-mobile-1234"
    [ "$AGENT_ROLE" = "ui-reviewer" ]
    [ "$AGENT_LANE" = "mobile" ]
    [ "$AGENT_ISSUE" = "1234" ]
}

@test "reviewer-1056 → role=reviewer, lane='', issue=1056" {
    parse_agent_name "reviewer-1056"
    [ "$AGENT_ROLE" = "reviewer" ]
    [ "$AGENT_LANE" = "" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "infra-reviewer-1056 → role=infra-reviewer, lane='', issue=1056" {
    parse_agent_name "infra-reviewer-1056"
    [ "$AGENT_ROLE" = "infra-reviewer" ]
    [ "$AGENT_LANE" = "" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "ui-designer-1056 → role=ui-designer, lane='', issue=1056" {
    parse_agent_name "ui-designer-1056"
    [ "$AGENT_ROLE" = "ui-designer" ]
    [ "$AGENT_LANE" = "" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "ui-designer-mobile-1056 → role=ui-designer, lane=mobile, issue=1056" {
    parse_agent_name "ui-designer-mobile-1056"
    [ "$AGENT_ROLE" = "ui-designer" ]
    [ "$AGENT_LANE" = "mobile" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "reviewer-api-1056 → role=reviewer, lane=api, issue=1056" {
    parse_agent_name "reviewer-api-1056"
    [ "$AGENT_ROLE" = "reviewer" ]
    [ "$AGENT_LANE" = "api" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

@test "infra-reviewer-ci-1056 → role=infra-reviewer, lane=ci, issue=1056" {
    parse_agent_name "infra-reviewer-ci-1056"
    [ "$AGENT_ROLE" = "infra-reviewer" ]
    [ "$AGENT_LANE" = "ci" ]
    [ "$AGENT_ISSUE" = "1056" ]
}

# -------------------------------------------------------------------------
# parse_agent_name: 不正入力 → return 1
# -------------------------------------------------------------------------

@test "旧形式 issue-1056-coder は失敗すること" {
    run parse_agent_name "issue-1056-coder"
    [ "$status" -ne 0 ]
}

@test "role のみ (coder) は失敗すること" {
    run parse_agent_name "coder"
    [ "$status" -ne 0 ]
}

@test "trailing dash (coder-) は失敗すること" {
    run parse_agent_name "coder-"
    [ "$status" -ne 0 ]
}

@test "数字始まり (1056-coder) は失敗すること" {
    run parse_agent_name "1056-coder"
    [ "$status" -ne 0 ]
}

@test "空文字は失敗すること" {
    run parse_agent_name ""
    [ "$status" -ne 0 ]
}

@test "未知の role (unknown-1056) は失敗すること" {
    run parse_agent_name "unknown-1056"
    [ "$status" -ne 0 ]
}

# -------------------------------------------------------------------------
# build_agent_name
# -------------------------------------------------------------------------

@test "build_agent_name analyst 1146 → analyst-1146" {
    result=$(build_agent_name "analyst" "1146")
    [ "$result" = "analyst-1146" ]
}

@test "build_agent_name coder 1056 → coder-1056" {
    result=$(build_agent_name "coder" "1056")
    [ "$result" = "coder-1056" ]
}

@test "build_agent_name coder 1056 api → coder-api-1056" {
    result=$(build_agent_name "coder" "1056" "api")
    [ "$result" = "coder-api-1056" ]
}

@test "build_agent_name infra-engineer 1056 ci → infra-engineer-ci-1056" {
    result=$(build_agent_name "infra-engineer" "1056" "ci")
    [ "$result" = "infra-engineer-ci-1056" ]
}

@test "build_agent_name e2e-reviewer 1234 → e2e-reviewer-1234" {
    result=$(build_agent_name "e2e-reviewer" "1234")
    [ "$result" = "e2e-reviewer-1234" ]
}
