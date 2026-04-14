#!/usr/bin/env bash
# scripts/verify-uncached.sh
#
# 現 worktree で Turbo cache replay に頼らず typecheck/test を再実行する。
# 使い方:
#   scripts/verify-uncached.sh               # typecheck → test を uncached 実行
#   scripts/verify-uncached.sh typecheck     # typecheck のみ
#   scripts/verify-uncached.sh test          # test のみ

set -euo pipefail

TASKS=("$@")
if [ ${#TASKS[@]} -eq 0 ]; then
  TASKS=(typecheck test)
fi

for task in "${TASKS[@]}"; do
  echo "==> uncached: turbo run ${task} --force --no-cache"
  pnpm turbo run "${task}" --force --no-cache
done
