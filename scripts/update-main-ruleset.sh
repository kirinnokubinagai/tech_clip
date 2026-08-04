#!/usr/bin/env bash
# main 保護 ruleset の required status check を ci-gate に差し替える冪等スクリプト。
# 対象 PR の check-runs で name=ci-gate を確認した上で、PR マージ後に手動で実行すること。
#
# NOTE: required_status_checks の context は GitHub の check run 名と完全一致が必要。
# Workflow の context 形式は <job name> であり、workflow 表示名・matrix・event trigger は含まれない。
# workflow 表示名が "CI"、job 名が "ci-gate" の場合、指定する context は "ci-gate"。
set -euo pipefail

REPO="${REPO:-kirinnokubinagai/tech_clip}"
RULESET_ID="${RULESET_ID:-14698666}"

CONFIG_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/config.json"
CONFIG_CHECK=""
if [ -f "$CONFIG_FILE" ] && command -v jq >/dev/null 2>&1; then
  CONFIG_CHECK=$(jq -r '.required_status_check_context // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
fi
REQUIRED_CHECK="${REQUIRED_CHECK:-${CONFIG_CHECK:-ci-gate}}"

command -v gh >/dev/null 2>&1 || { echo "gh が必要です" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq が必要です" >&2; exit 1; }

echo "Fetching ruleset ${RULESET_ID} from ${REPO}..."
current=$(gh api "repos/${REPO}/rulesets/${RULESET_ID}")

payload=$(jq -n --argjson c "$current" --arg r "$REQUIRED_CHECK" '{
  name: $c.name,
  target: $c.target,
  enforcement: $c.enforcement,
  conditions: $c.conditions,
  bypass_actors: $c.bypass_actors,
  rules: [{
    type: "required_status_checks",
    parameters: {
      strict_required_status_checks_policy: false,
      do_not_enforce_on_create: false,
      required_status_checks: [{ context: $r }]
    }
  }]
}')

echo "Updating ruleset ${RULESET_ID}: required='${REQUIRED_CHECK}'..."
echo "$payload" | gh api --method PUT "repos/${REPO}/rulesets/${RULESET_ID}" --input -
echo "Done."
