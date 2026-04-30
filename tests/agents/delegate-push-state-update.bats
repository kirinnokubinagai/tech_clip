#!/usr/bin/env bats
# reviewer 系 agent definition と polling-wait skill の
# DELEGATE_PUSH / STATE_UPDATE 仕様を固定化するコントラクトテスト
#
# 実行: bats tests/agents/delegate-push-state-update.bats

REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"

REVIEWER_MD="$REPO_ROOT/.claude/agents/reviewer.md"
INFRA_REVIEWER_MD="$REPO_ROOT/.claude/agents/infra-reviewer.md"
UI_REVIEWER_MD="$REPO_ROOT/.claude/agents/ui-reviewer.md"
POLLING_WAIT_MD="$REPO_ROOT/.claude/skills/review/polling-wait/SKILL.md"

# -----------------------------------------------------------------------
# reviewer.md — DELEGATE_PUSH 仕様
# -----------------------------------------------------------------------

@test "reviewer.md: DELEGATE_PUSH メッセージ種別がメッセージテーブルに存在すること" {
  grep -q "DELEGATE_PUSH" "$REVIEWER_MD"
}

@test "reviewer.md: DELEGATE_PUSH 代行モードセクションが存在すること" {
  grep -q "DELEGATE_PUSH.*代行モード" "$REVIEWER_MD"
}

@test "reviewer.md: DELEGATE_PUSH 受信時に e2e-approved 履歴に依存しない旨が明記されていること" {
  grep -q "e2e-approved 履歴に依存しない" "$REVIEWER_MD"
}

@test "reviewer.md: DELEGATE_PUSH 後の verdict 通知は本来担当と orchestrator 両方に送る旨が明記されていること" {
  grep -q "team-lead.*両方" "$REVIEWER_MD"
}

@test "reviewer.md: STATE_UPDATE 送信義務が明記されていること" {
  grep -q "STATE_UPDATE" "$REVIEWER_MD"
}

# -----------------------------------------------------------------------
# infra-reviewer.md — DELEGATE_PUSH 仕様
# -----------------------------------------------------------------------

@test "infra-reviewer.md: DELEGATE_PUSH メッセージ種別がメッセージテーブルに存在すること" {
  grep -q "DELEGATE_PUSH" "$INFRA_REVIEWER_MD"
}

@test "infra-reviewer.md: DELEGATE_PUSH 代行モードセクションが存在すること" {
  grep -q "DELEGATE_PUSH.*代行モード" "$INFRA_REVIEWER_MD"
}

@test "infra-reviewer.md: DELEGATE_PUSH 受信時に e2e-approved 履歴に依存しない旨が明記されていること" {
  grep -q "e2e-approved 履歴に依存しない" "$INFRA_REVIEWER_MD"
}

@test "infra-reviewer.md: STATE_UPDATE 送信義務が明記されていること" {
  grep -q "STATE_UPDATE" "$INFRA_REVIEWER_MD"
}

# -----------------------------------------------------------------------
# ui-reviewer.md — DELEGATE_PUSH 仕様
# -----------------------------------------------------------------------

@test "ui-reviewer.md: DELEGATE_PUSH メッセージ種別がメッセージテーブルに存在すること" {
  grep -q "DELEGATE_PUSH" "$UI_REVIEWER_MD"
}

@test "ui-reviewer.md: DELEGATE_PUSH 代行モードセクションが存在すること" {
  grep -q "DELEGATE_PUSH.*代行モード" "$UI_REVIEWER_MD"
}

@test "ui-reviewer.md: STATE_UPDATE 送信義務が明記されていること" {
  grep -q "STATE_UPDATE" "$UI_REVIEWER_MD"
}

# -----------------------------------------------------------------------
# polling-wait SKILL.md — STATE_UPDATE 仕様
# -----------------------------------------------------------------------

@test "polling-wait SKILL.md: 進捗通知 STATE_UPDATE セクションが存在すること" {
  grep -q "STATE_UPDATE" "$POLLING_WAIT_MD"
}

@test "polling-wait SKILL.md: STATE_UPDATE 送信先が team-lead であること" {
  grep -q 'team-lead' "$POLLING_WAIT_MD"
  grep -A5 "STATE_UPDATE" "$POLLING_WAIT_MD" | grep -q "team-lead"
}

@test "polling-wait SKILL.md: STATE_UPDATE に failed/success/in_progress フィールドが含まれること" {
  grep -q "failed=\[" "$POLLING_WAIT_MD"
  grep -q "success=\[" "$POLLING_WAIT_MD"
  grep -q "in_progress=\[" "$POLLING_WAIT_MD"
}

@test "polling-wait SKILL.md: still_pending 時も状態変化があれば送信する旨が明記されていること" {
  grep -q "still_pending" "$POLLING_WAIT_MD"
  grep -A3 "still_pending で再 polling" "$POLLING_WAIT_MD" | grep -q "状態に変化があれば"
}
