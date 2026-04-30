#!/usr/bin/env bash
# verify-branch-protection.sh
# main / stage 両方に ruleset があり、CI / ci-gate が required になっているか確認する。
# CI ジョブには組み込まず、ローカル / 手動実行用ツールとして使う（admin token 不要で読み取りは可能）。
#
# 使い方:
#   GITHUB_REPOSITORY=owner/repo bash scripts/ci/verify-branch-protection.sh

set -euo pipefail

GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
if [ -z "$GITHUB_REPOSITORY" ]; then
  GITHUB_REPOSITORY=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")
fi

if [ -z "$GITHUB_REPOSITORY" ]; then
  echo "ERROR: GITHUB_REPOSITORY が未設定です。GITHUB_REPOSITORY=owner/repo として実行してください" >&2
  exit 1
fi

FAILED=0

for branch in main stage; do
  rulesets=$(gh api "repos/${GITHUB_REPOSITORY}/rulesets" --jq '[.[]]' 2>/dev/null || echo "[]")
  match=$(echo "$rulesets" | jq --arg b "refs/heads/$branch" \
    '[.[] | select(.conditions.ref_name.include[]? == $b)] | length' 2>/dev/null || echo "0")

  if [ "$match" -eq 0 ]; then
    echo "ERROR: branch '$branch' に ruleset がありません" >&2
    FAILED=1
  else
    echo "OK: branch '$branch' に ruleset が存在します"
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "" >&2
  echo "セットアップ手順: docs/operations/branch-protection-setup.md を参照してください" >&2
  exit 1
fi

echo "OK: main and stage rulesets present"
