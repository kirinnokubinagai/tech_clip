#!/usr/bin/env bash
# push-verified.sh
# 現在のブランチを push し、ローカルとリモートの SHA が一致することを検証する
#
# 使い方:
#   bash scripts/push-verified.sh
set -euo pipefail

LOCAL_SHA=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "ブランチを push 中: ${BRANCH} (${LOCAL_SHA})"

git push origin HEAD

git fetch origin "${BRANCH}"
REMOTE_SHA=$(git rev-parse "origin/${BRANCH}")

if [ "${LOCAL_SHA}" = "${REMOTE_SHA}" ]; then
  echo "push 検証成功: ${LOCAL_SHA}"
else
  echo "push 検証失敗" >&2
  echo "  ローカル:  ${LOCAL_SHA}" >&2
  echo "  リモート: ${REMOTE_SHA}" >&2
  exit 1
fi
