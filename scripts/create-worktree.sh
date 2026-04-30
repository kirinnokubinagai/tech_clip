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

REPO_ROOT=$(cd "$(env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --git-common-dir)/.." && pwd)
WORKTREE_BASE=$(dirname "${REPO_ROOT}")
WORKTREE_PATH="${WORKTREE_BASE}/issue-${ISSUE_NUMBER}"
BRANCH_NAME="issue/${ISSUE_NUMBER}/${SHORT_DESC}"

if [[ -e "${WORKTREE_PATH}" ]]; then
  echo "❌ worktree 作成先が既に存在します: ${WORKTREE_PATH}" >&2
  exit 1
fi

# Issue #1138: feature/* は origin/stage から分岐させる。stage が未存在なら origin/main にフォールバック。
if git ls-remote --exit-code --heads origin stage >/dev/null 2>&1; then
  BASE_REF="origin/stage"
  BASE_NAME="stage"
else
  BASE_REF="origin/main"
  BASE_NAME="main"
fi

echo "📥 ${BASE_REF} を更新..."
git fetch origin "${BASE_NAME}"
# main worktree のローカル main を origin/main に FF merge する。
# 非 FF（未 push コミットがある等）の場合は失敗するが、worktree 作成自体は続行したいため || true で握り潰す。
git -C "${REPO_ROOT}" merge --ff-only origin/main --quiet 2>/dev/null || true

echo "🌳 worktree を作成... (base=${BASE_REF})"
git worktree add "${WORKTREE_PATH}" -b "${BRANCH_NAME}" "${BASE_REF}"

if command -v direnv >/dev/null 2>&1 && [[ -f "${WORKTREE_PATH}/.envrc" ]]; then
  echo "🔓 direnv allow を実行..."
  (
    cd "${WORKTREE_PATH}"
    direnv allow .
  )

  echo "✅ direnv 状態を確認..."
  if ! (
    cd "${WORKTREE_PATH}"
    direnv exec "${WORKTREE_PATH}" true >/dev/null 2>&1
  ); then
    echo "❌ direnv allow の反映を確認できませんでした" >&2
    echo "  手動で確認してください: cd ${WORKTREE_PATH} && direnv allow ." >&2
    exit 1
  fi
elif [[ -f "${WORKTREE_PATH}/.envrc" ]]; then
  echo "❌ .envrc があるため direnv が必要です: ${WORKTREE_PATH}" >&2
  exit 1
fi

echo "📦 依存関係をセットアップ..."
if command -v direnv >/dev/null 2>&1 && [[ -f "${WORKTREE_PATH}/.envrc" ]]; then
  (
    cd "${WORKTREE_PATH}"
    direnv exec "${WORKTREE_PATH}" pnpm install --frozen-lockfile
  )
else
  (
    cd "${WORKTREE_PATH}"
    pnpm install --frozen-lockfile
  )
fi

mkdir -p "${WORKTREE_PATH}/.claude/polling"

cat <<EOF
✅ worktree 作成完了
  path:   ${WORKTREE_PATH}
  branch: ${BRANCH_NAME}

次:
  cd ${WORKTREE_PATH}
EOF
