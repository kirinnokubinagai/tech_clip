#!/usr/bin/env bats

@test "review-merged-cleanup SKILL.md は analyst と e2e-reviewer 両方への shutdown_request を記述している" {
  local skill_md=".claude/skills/review/merged-cleanup/SKILL.md"
  # lane-A が rename した場合の新パスも確認
  if [ ! -f "$skill_md" ]; then
    skill_md=".claude/skills/review-merged-cleanup/SKILL.md"
  fi
  grep -q 'analyst' "$skill_md"
  grep -q 'e2e-reviewer' "$skill_md"
  grep -q 'shutdown_request' "$skill_md"
  # 3 体への送信記述があることを確認（行数で代用）
  [ "$(grep -c 'shutdown_request' "$skill_md")" -ge 3 ]
}
