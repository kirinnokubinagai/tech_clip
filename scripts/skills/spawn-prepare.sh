#!/usr/bin/env bash
# spawn-prepare.sh: Issue 着手の前準備を一括実行する
#
# 1. worktree を作成
# 2. shard_total を判定
# 3. 必要パラメータを JSON で出力
#
# orchestrator は出力 JSON を読んで、その値で 4 体セット spawn を実行する。
#
# 使い方:
#   bash scripts/skills/spawn-prepare.sh <issue-number> <kebab-case-desc>
#
# 出力（JSON 1 行）:
#   {"issue":1234,"worktree":"/path/to/issue-1234","shard_total":4,"impl_role":"coder","reviewer_role":"reviewer"}
#
# impl_role / reviewer_role は Issue body と labels から推測:
#   - infra ラベル / .github/ / scripts/ などのパスメンション → infra-engineer / infra-reviewer
#   - ui ラベル / mobile ラベル + コンポーネント mention → ui-designer / ui-reviewer
#   - それ以外 → coder / reviewer

set -euo pipefail

ISSUE_NUM="${1:?usage: spawn-prepare.sh <issue-number> <desc>}"
DESC="${2:?usage: spawn-prepare.sh <issue-number> <desc>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# zone 衝突最終チェック
ACTIVE_ZONES_JSON=$(bash "$SCRIPT_DIR/list-active-zones.sh" --json --exclude-issue "$ISSUE_NUM")
ISSUE_ZONES_JSON=$(bash "$SCRIPT_DIR/detect-issue-zones.sh" --issue "$ISSUE_NUM" --json)

CONFLICTING=$(jq -n \
  --argjson active "$ACTIVE_ZONES_JSON" \
  --argjson mine "$ISSUE_ZONES_JSON" \
  '($mine.zones // []) - (($mine.zones // []) - ($active.active_zones // []))')

if [ "$(echo "$CONFLICTING" | jq 'length')" -gt 0 ]; then
  echo "ERROR: zone conflict detected. Spawn aborted." >&2
  echo "  This issue zones: $(echo "$ISSUE_ZONES_JSON" | jq -c '.zones')" >&2
  echo "  Currently active zones: $(echo "$ACTIVE_ZONES_JSON" | jq -c '.active_zones')" >&2
  echo "  Conflicting: $(echo "$CONFLICTING" | jq -c '.')" >&2
  echo "  → Wait for blocking issue(s) to merge, then re-spawn." >&2
  exit 1
fi

# 1. worktree 作成（既存の場合はスキップ）
WORKTREE="${REPO_ROOT}/../issue-${ISSUE_NUM}"
if [ ! -d "$WORKTREE" ]; then
  bash "${REPO_ROOT}/scripts/create-worktree.sh" "$ISSUE_NUM" "$DESC" >&2
fi

# 2. shard_total 判定
SHARD_TOTAL=$(bash "${SCRIPT_DIR}/decide-shard-total.sh")

# 3. impl_role / reviewer_role の推定
ISSUE_DATA=$(gh issue view "$ISSUE_NUM" --json title,body,labels 2>/dev/null || echo '{}')
LABELS=$(echo "$ISSUE_DATA" | jq -r '.labels[]?.name // empty' 2>/dev/null | tr '\n' ' ')
TEXT=$(echo "$ISSUE_DATA" | jq -r '.title + " " + (.body // "")' 2>/dev/null)

IMPL_ROLE="coder"
REVIEWER_ROLE="reviewer"

if echo "$LABELS" | grep -qiE '(^| )(infra|ci|ops)( |$)' || \
   echo "$TEXT" | grep -qiE '\.github/|nix flake|cloudflare|runpod|workflow|scripts/(ci|gate|dev)/|infra'; then
  IMPL_ROLE="infra-engineer"
  REVIEWER_ROLE="infra-reviewer"
elif echo "$LABELS" | grep -qiE '(^| )(ui|design)( |$)' || \
     echo "$TEXT" | grep -qiE 'コンポーネント|mockup|モックアップ|アイコン|デザイン|ui[ -]|nativewind|lucide'; then
  IMPL_ROLE="ui-designer"
  REVIEWER_ROLE="ui-reviewer"
fi

# JSON 出力
WORKTREE_ABS=$(cd "$WORKTREE" && pwd -P)
jq -n \
  --argjson issue "$ISSUE_NUM" \
  --arg worktree "$WORKTREE_ABS" \
  --argjson shard_total "$SHARD_TOTAL" \
  --arg impl_role "$IMPL_ROLE" \
  --arg reviewer_role "$REVIEWER_ROLE" \
  '{
    issue: $issue,
    worktree: $worktree,
    shard_total: $shard_total,
    impl_role: $impl_role,
    reviewer_role: $reviewer_role,
    agents: [
      {role: "analyst",      name: "issue-\($issue)-analyst"},
      {role: $impl_role,     name: "issue-\($issue)-\($impl_role)"},
      {role: "e2e-reviewer", name: "issue-\($issue)-e2e-reviewer"},
      {role: $reviewer_role, name: "issue-\($issue)-\($reviewer_role)"}
    ]
  }'
