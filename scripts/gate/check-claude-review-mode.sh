#!/usr/bin/env bash
# check-claude-review-mode.sh: claude-review bot の動作モードを判定する
#
# 使い方: bash scripts/gate/check-claude-review-mode.sh <PR_NUMBER>
# stdout: "auto" | "manual"
# exit 0: 常に成功

set -euo pipefail

PR_NUMBER="${1:?PR number required}"

CONCLUSION=$(gh pr checks "$PR_NUMBER" --json name,conclusion \
  --jq '.[] | select(.name == "claude-review") | .conclusion' 2>/dev/null | head -1 || true)

if [ -z "$CONCLUSION" ] || [ "$CONCLUSION" = "skipped" ]; then
  echo "manual"
else
  echo "auto"
fi
