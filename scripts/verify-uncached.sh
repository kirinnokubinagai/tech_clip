#!/usr/bin/env bash
# scripts/verify-uncached.sh
#
# 現 worktree で Turbo cache replay に頼らず typecheck/test を再実行する。
# 使い方:
#   scripts/verify-uncached.sh               # typecheck → test を uncached 実行
#   scripts/verify-uncached.sh typecheck     # typecheck のみ
#   scripts/verify-uncached.sh test          # test のみ

set -euo pipefail

# 任意の turbo タスクを uncached で実行できる汎用スクリプト。
# package.json の *:uncached スクリプトから呼ばれるほか、手動実行にも使える。
# タスク名バリデーションは意図的に省略しており、呼び出し元で制御する設計。
TASKS=("$@")
if [ ${#TASKS[@]} -eq 0 ]; then
  TASKS=(typecheck test)
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for task in "${TASKS[@]}"; do
  echo "==> uncached: turbo run ${task} --force --no-cache"
  if [ "${task}" = "test" ]; then
    "${SCRIPT_DIR}/run-and-fail-on-stderr.sh" pnpm turbo run "${task}" --force --no-cache
  else
    pnpm turbo run "${task}" --force --no-cache
  fi
done
