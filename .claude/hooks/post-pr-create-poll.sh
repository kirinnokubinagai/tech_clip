#!/usr/bin/env bash
# post-pr-create-poll.sh
# gh pr create 実行後に自動的に poll-pr-review.sh をバックグラウンドで起動する
#
# PostToolUse (Bash) フックとして呼び出される
# ARGUMENTS 環境変数: {"command": "..."}
# timeout: 15s (gh pr view のネットワーク呼び出しのため他フックより長め)

set -uo pipefail

# jq が必要（他フックと同様の早期チェック）
command -v jq >/dev/null 2>&1 || exit 0

# コマンド文字列を取得
command_str=$(printf '%s' "${ARGUMENTS:-}" | jq -r '.command // ""' 2>/dev/null || true)
[[ -n "${command_str}" ]] || exit 0

# gh pr create を含むコマンドのみ処理（単語境界を考慮した正規表現）
# "git commit -m 'gh pr create'" などの誤検知を防ぐ
printf '%s\n' "${command_str}" | grep -qE '(^|&&[[:space:]]*|\|\|[[:space:]]*|;[[:space:]]*)gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)' || exit 0

# worktree パスを cd コマンドから抽出（スペースなしパスのみ対応）
worktree_path=""
if printf '%s\n' "${command_str}" | grep -qE "^cd [^&;[:space:]]"; then
  raw_path=$(printf '%s\n' "${command_str}" | sed -E 's|^cd ([^[:space:]&;]+).*|\1|' | head -1)
  # クォートを除去
  raw_path="${raw_path//\'/}"
  raw_path="${raw_path//\"/}"
  # realpath で正規化
  if [[ -d "${raw_path}" ]]; then
    worktree_path=$(cd "${raw_path}" 2>/dev/null && pwd -P) || worktree_path=""
  fi
fi

# worktree パスが特定できない場合はスキップ（誤った CWD でポーリングしないよう pwd フォールバックは使わない）
[[ -n "${worktree_path}" ]] || exit 0

# git リポジトリ内であることを確認（ディレクトリトラバーサル対策）
git -C "${worktree_path}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# PR番号を取得（--dry-run / --web などで PR が未作成の場合は自然にスキップ）
PR_NUMBER=$(cd "${worktree_path}" && gh pr view HEAD --json number --jq '.number' 2>/dev/null || true)
if [[ -z "${PR_NUMBER}" ]] || ! [[ "${PR_NUMBER}" =~ ^[0-9]+$ ]]; then
  exit 0
fi

# プロジェクトルートとスクリプトパス
ROOT=$(git -C "${worktree_path}" rev-parse --show-toplevel 2>/dev/null || true)
[[ -n "${ROOT}" ]] || exit 0

POLL_SCRIPT="${ROOT}/scripts/poll-pr-review.sh"
[[ -f "${POLL_SCRIPT}" ]] || exit 0

# ユーザー固有のログディレクトリ（/tmp シンボリックリンク攻撃対策）
LOG_DIR="${TMPDIR:-/tmp}/tech-clip-poll-pr-$(id -u)"
mkdir -p "${LOG_DIR}" || exit 0
if [[ -L "${LOG_DIR}" ]]; then
  echo "[poll-pr] ログディレクトリがシンボリックリンクです。中止します: ${LOG_DIR}" >&2
  exit 0
fi
chmod 700 "${LOG_DIR}" || exit 0
LOG_FILE="${LOG_DIR}/poll-pr-${PR_NUMBER}.log"
if [[ -L "${LOG_FILE}" ]]; then
  echo "[poll-pr] ログファイルがシンボリックリンクです。中止します: ${LOG_FILE}" >&2
  exit 0
fi

# 既に同じ PR のポーリングが実行中かチェック
# 末尾アンカーで PR#1 のチェックが PR#12 にマッチする誤検知を防止
if pgrep -f "poll-pr-review\\.sh ${PR_NUMBER}$" > /dev/null 2>&1; then
  echo "[poll-pr] PR #${PR_NUMBER} は既にポーリング中です" >&2
  exit 0
fi

# バックグラウンドでポーリング開始（stdin も /dev/null にリダイレクト）
nohup bash "${POLL_SCRIPT}" "${PR_NUMBER}" </dev/null >"${LOG_FILE}" 2>&1 &
disown $!

echo "[poll-pr] PR #${PR_NUMBER} のポーリングを開始しました (log: ${LOG_FILE})" >&2
exit 0
