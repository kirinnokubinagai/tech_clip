#!/usr/bin/env bash
# create-worktree.sh
# Issue 用 worktree を作成し、direnv allow と依存セットアップまでまとめて実行する
#
# 使い方:
#   scripts/create-worktree.sh <issue-number> <short-desc>

set -euo pipefail

ISSUE_NUMBER="${1:-}"
SHORT_DESC="${2:-}"

if [[ -z "${ISSUE_NUMBER}" || -z "${SHORT_DESC}" ]]; then
  echo "usage: scripts/create-worktree.sh <issue-number> <short-desc>" >&2
  exit 1
fi

if [[ ! "${ISSUE_NUMBER}" =~ ^[0-9]+$ ]]; then
  echo "❌ issue-number は数値で指定してください: ${ISSUE_NUMBER}" >&2
  exit 1
fi

if [[ ! "${SHORT_DESC}" =~ ^[a-z0-9-]+$ ]]; then
  echo "❌ short-desc は kebab-case で指定してください: ${SHORT_DESC}" >&2
  exit 1
fi

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
WORKTREE_BASE=$(dirname "${REPO_ROOT}")
WORKTREE_PATH="${WORKTREE_BASE}/issue-${ISSUE_NUMBER}"
BRANCH_NAME="issue/${ISSUE_NUMBER}/${SHORT_DESC}"

if [[ -e "${WORKTREE_PATH}" ]]; then
  echo "❌ worktree 作成先が既に存在します: ${WORKTREE_PATH}" >&2
  exit 1
fi

echo "📥 origin/main を更新..."
git fetch origin main:main

echo "🌳 worktree を作成..."
git worktree add "${WORKTREE_PATH}" -b "${BRANCH_NAME}" origin/main

if command -v direnv >/dev/null 2>&1 && [[ -f "${WORKTREE_PATH}/.envrc" ]]; then
  echo "🔓 direnv allow を実行..."
  (
    cd "${WORKTREE_PATH}"
    direnv allow .
  )
fi

echo "📦 依存関係をセットアップ..."
(
  cd "${WORKTREE_PATH}"
  pnpm install --frozen-lockfile
)

cat <<EOF
✅ worktree 作成完了
  path:   ${WORKTREE_PATH}
  branch: ${BRANCH_NAME}

次:
  cd ${WORKTREE_PATH}
EOF
