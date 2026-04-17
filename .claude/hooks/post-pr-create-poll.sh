#!/usr/bin/env bash
# post-pr-create-poll.sh
# gh pr create 実行後に自動的に poll-pr-review.sh をバックグラウンドで起動し、
# 同時に .claude/polling/ に state ファイルを作成する。
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
printf '%s\n' "${command_str}" | grep -qE '(^|&&[[:space:]]*|\|\|[[:space:]]*|;[[:space:]]*)gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)' || exit 0

# worktree パスを cd コマンドから抽出（スペースなしパスのみ対応）
worktree_path=""
if printf '%s\n' "${command_str}" | grep -qE "^cd [^&;[:space:]]"; then
  raw_path=$(printf '%s\n' "${command_str}" | sed -E 's|^cd ([^[:space:]&;]+).*|\1|' | head -1)
  raw_path="${raw_path//\'/}"
  raw_path="${raw_path//\"/}"
  if [[ -d "${raw_path}" ]]; then
    worktree_path=$(cd "${raw_path}" 2>/dev/null && pwd -P) || worktree_path=""
  fi
fi

[[ -n "${worktree_path}" ]] || exit 0

# git リポジトリ内であることを確認
git -C "${worktree_path}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# PR番号を取得
PR_NUMBER=$(cd "${worktree_path}" && gh pr view HEAD --json number --jq '.number' 2>/dev/null || true)
if [[ -z "${PR_NUMBER}" ]] || ! [[ "${PR_NUMBER}" =~ ^[0-9]+$ ]]; then
  exit 0
fi

# プロジェクトルートとスクリプトパス
ROOT=$(git -C "${worktree_path}" rev-parse --show-toplevel 2>/dev/null || true)
[[ -n "${ROOT}" ]] || exit 0

# PUSH_SHA を取得
PUSH_SHA=$(git -C "${worktree_path}" rev-parse HEAD 2>/dev/null || true)
[[ -n "${PUSH_SHA}" ]] || exit 0

# Issue 番号を branch 名から推測（issue/<N>/... 形式）
BRANCH=$(git -C "${worktree_path}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
ISSUE_NUMBER=$(echo "$BRANCH" | grep -oE '^issue/([0-9]+)' | grep -oE '[0-9]+' | head -1 || true)

# worktree ベース名から推測（issue-<N> 形式）
if [[ -z "$ISSUE_NUMBER" ]]; then
  WT_BASENAME=$(basename "${worktree_path}")
  ISSUE_NUMBER=$(echo "$WT_BASENAME" | grep -oE '^issue-([0-9]+)' | grep -oE '[0-9]+' | head -1 || true)
fi

[[ -n "$ISSUE_NUMBER" ]] || ISSUE_NUMBER="unknown"
AGENT_NAME="issue-${ISSUE_NUMBER}-reviewer"

# .claude/polling/ state ファイルを作成（orchestrator ポーリング用）
POLLING_DIR="${ROOT}/.claude/polling"
mkdir -p "${POLLING_DIR}" || true
STATE_FILE="${POLLING_DIR}/pr-${PR_NUMBER}.json"
if [[ ! -f "${STATE_FILE}" ]]; then
  cat > "${STATE_FILE}" << JSON_EOF
{
  "pr_number": ${PR_NUMBER},
  "push_sha": "${PUSH_SHA}",
  "issue_number": "${ISSUE_NUMBER}",
  "agent_name": "${AGENT_NAME}",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON_EOF
  echo "[poll] .claude/polling/pr-${PR_NUMBER}.json を作成しました" >&2
fi

POLL_SCRIPT="${ROOT}/scripts/poll-pr-review.sh"
[[ -f "${POLL_SCRIPT}" ]] || exit 0

# ユーザー固有のログディレクトリ
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
if pgrep -f "poll-pr-review\\.sh ${PR_NUMBER}$" > /dev/null 2>&1; then
  echo "[poll-pr] PR #${PR_NUMBER} は既にポーリング中です" >&2
  exit 0
fi

# バックグラウンドでポーリング開始
nohup bash "${POLL_SCRIPT}" "${PR_NUMBER}" </dev/null >"${LOG_FILE}" 2>&1 &
disown $!

echo "[poll-pr] PR #${PR_NUMBER} のポーリングを開始しました (log: ${LOG_FILE})" >&2
exit 0
