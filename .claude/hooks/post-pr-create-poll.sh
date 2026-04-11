#!/usr/bin/env bash
# post-pr-create-poll.sh
# gh pr create 実行後に自動的に poll-pr-review.sh をバックグラウンドで起動する
#
# PostToolUse (Bash) フックとして呼び出される
# ARGUMENTS 環境変数: {"command": "...", "output": "..."}

set -uo pipefail

ARGUMENTS="${ARGUMENTS:-}"
[[ -z "${ARGUMENTS}" ]] && exit 0

# コマンド文字列を取得
command_str=$(echo "${ARGUMENTS}" | jq -r '.command // ""' 2>/dev/null || true)
[[ -z "${command_str}" ]] && exit 0

# gh pr create を含むコマンドのみ処理
echo "${command_str}" | grep -q "gh pr create" || exit 0

# --dry-run や --web フラグは PR を作成しないのでスキップ
echo "${command_str}" | grep -qE "(--dry-run|--web)" && exit 0

# worktree パスを cd コマンドから抽出
# パターン: "cd /path/to/worktree && ..."
worktree_path=""
if echo "${command_str}" | grep -qE "^cd "; then
  raw_path=$(echo "${command_str}" | sed -E 's|^cd ([^ ]+).*|\1|' | head -1)
  # クォートを除去
  worktree_path="${raw_path//\'/}"
  worktree_path="${worktree_path//\"/}"
fi

if [[ -z "${worktree_path}" ]] || [[ ! -d "${worktree_path}" ]]; then
  worktree_path="$(pwd)"
fi

# PR番号を取得（PR が存在しない場合は終了）
PR_NUMBER=$(cd "${worktree_path}" && gh pr view HEAD --json number --jq '.number' 2>/dev/null || true)
if [[ -z "${PR_NUMBER}" ]] || ! [[ "${PR_NUMBER}" =~ ^[0-9]+$ ]]; then
  exit 0
fi

# プロジェクトルートとスクリプトパス
ROOT=$(git -C "${worktree_path}" rev-parse --show-toplevel 2>/dev/null || true)
[[ -z "${ROOT}" ]] && exit 0

POLL_SCRIPT="${ROOT}/scripts/poll-pr-review.sh"
[[ -f "${POLL_SCRIPT}" ]] || exit 0

# 既に同じ PR のポーリングが実行中かチェック
if pgrep -f "poll-pr-review.sh ${PR_NUMBER}" > /dev/null 2>&1; then
  echo "[poll-pr] PR #${PR_NUMBER} は既にポーリング中です" >&2
  exit 0
fi

# バックグラウンドでポーリング開始
LOG_FILE="/tmp/poll-pr-${PR_NUMBER}.log"
nohup bash "${POLL_SCRIPT}" "${PR_NUMBER}" > "${LOG_FILE}" 2>&1 &
disown $!

echo "[poll-pr] PR #${PR_NUMBER} のポーリングを開始しました (log: ${LOG_FILE})" >&2
exit 0
