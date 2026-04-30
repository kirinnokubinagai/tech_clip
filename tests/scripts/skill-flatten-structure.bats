#!/usr/bin/env bats

REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"

@test "全 SKILL.md は .claude/skills/<name>/SKILL.md の 1 階層配置" {
  local nested
  nested=$(find "$REPO_ROOT/.claude/skills" -mindepth 3 -name SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  [ "$nested" -eq 0 ]
}

@test "全 SKILL.md frontmatter name とディレクトリ名が一致" {
  local failed=0
  while IFS= read -r skill_md; do
    local dir_name name_in_md
    dir_name=$(basename "$(dirname "$skill_md")")
    name_in_md=$(awk '/^name:/{print $2; exit}' "$skill_md")
    if [ "$dir_name" != "$name_in_md" ]; then
      echo "Mismatch: $skill_md (dir=$dir_name name=$name_in_md)"
      failed=1
    fi
  done < <(find "$REPO_ROOT/.claude/skills" -mindepth 2 -maxdepth 2 -name SKILL.md)
  [ "$failed" -eq 0 ]
}

@test "CLAUDE.md に旧形式 (slash) の skill 参照が残っていない（trigger 後方互換 entry 除く）" {
  local hits
  hits=$(grep -nEo "(harness|review|impl|code|design|security|e2e|orchestrator)/[a-z][a-z0-9-]*" "$REPO_ROOT/CLAUDE.md" 2>/dev/null \
    | grep -vE "\.claude/skills/(harness|review|impl|code|design|security|e2e|orchestrator)" \
    | wc -l | tr -d ' ')
  [ "$hits" -eq 0 ]
}
