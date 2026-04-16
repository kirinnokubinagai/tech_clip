#!/usr/bin/env bash
# main 保護 ruleset の required status check を CI / ci-gate に差し替える冪等スクリプト。
# PR マージ後に手動で実行すること（逆順実行は全 PR BLOCKED になるため厳禁）。
set -euo pipefail

REPO="${REPO:-kirinnokubinagai/tech_clip}"
RULESET_ID="${RULESET_ID:-14698666}"
REQUIRED_CHECK="${REQUIRED_CHECK:-CI / ci-gate}"

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
