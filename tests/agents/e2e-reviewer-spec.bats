#!/usr/bin/env bats

@test "e2e-reviewer.md は 'Bash の until / while ループ内に監視ロジックを書かない' 旨を明示している" {
  grep -q "until\|while" .claude/agents/e2e-reviewer.md
  grep -q "Bash がブロッキング\|SendMessage を発行できなく" .claude/agents/e2e-reviewer.md
}

@test "e2e-reviewer.md は監視ループ最大 iteration を明示している" {
  grep -E "60 iteration|30 分" .claude/agents/e2e-reviewer.md
}

@test "e2e-reviewer.md は STATE_UPDATE のタイミング表を保持している" {
  grep -q 'STATE_UPDATE: issue-{N}-e2e-reviewer' .claude/agents/e2e-reviewer.md
  grep -q 'flow <flow_name> PASS/FAIL' .claude/agents/e2e-reviewer.md
  grep -q 'shard X/N completed' .claude/agents/e2e-reviewer.md
}
