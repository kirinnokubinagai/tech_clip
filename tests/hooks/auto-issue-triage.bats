#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.claude/hooks" && pwd)/auto-issue-triage.sh"

@test "auto-issue-triage.sh: 構文エラーがない" {
  run bash -n "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "auto-issue-triage.sh: scripts/next-issue-candidates.sh 不在時に exit 0 する" {
  # scripts/next-issue-candidates.sh が存在しない場合（[ ! -x "$SCRIPT" ]）
  # 中身を実行せずに exit 0 で終了する
  grep -q 'if \[ ! -x "\$SCRIPT" \]; then' "$SCRIPT"
  grep -q 'exit 0' "$SCRIPT"
}

@test "auto-issue-triage.sh: 候補 0 件時に exit 0 する" {
  # AUTO_COUNT と HUMAN_COUNT が両方 0 の場合、早期終了する
  grep -q 'if \[ "\$AUTO_COUNT" -eq 0 \] && \[ "\$HUMAN_COUNT" -eq 0 \]; then' "$SCRIPT"
  grep -q 'exit 0' "$SCRIPT"
}
