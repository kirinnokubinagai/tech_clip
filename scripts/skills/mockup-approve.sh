#!/usr/bin/env bash
# mockup-approve.sh: orchestrator がユーザーの承認後に mockup-approved フラグを書き込む
#
# orchestrator-flow-guard.sh の C-1b は ui-designer が ui-reviewer に impl-ready を送る前に
# `mockup-approved-{N}.flag` (30 分以内) を要求する。このスクリプトはその flag を書き込む。
#
# 使い方:
#   bash scripts/skills/mockup-approve.sh <issue-number>
#
# 環境変数:
#   CLAUDE_USER_ROOT: フラグ書き込み先のルート（デフォルト REPO/.claude-user）
#
# 動作:
#   <root>/projects/<project-id>/memory/mockup-approved-<issue>.flag に
#   現在時刻 (ISO8601 UTC) を書き込む。

set -euo pipefail

ISSUE_NUM="${1:?usage: mockup-approve.sh <issue-number>}"

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CLAUDE_USER_ROOT="${CLAUDE_USER_ROOT:-${REPO_ROOT}/.claude-user}"

# project-id の特定: 既存ディレクトリの最初を使う、なければ新規作成
PROJECT_DIR=$(ls -d "${CLAUDE_USER_ROOT}/projects/"*/memory 2>/dev/null | head -1 || true)
if [ -z "$PROJECT_DIR" ]; then
  # 新規作成 (project id はリポジトリ名から)
  PROJECT_ID=$(basename "$REPO_ROOT" | tr -c 'a-zA-Z0-9' '-')
  PROJECT_DIR="${CLAUDE_USER_ROOT}/projects/${PROJECT_ID}/memory"
  mkdir -p "$PROJECT_DIR"
fi

FLAG_PATH="${PROJECT_DIR}/mockup-approved-${ISSUE_NUM}.flag"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$NOW" > "$FLAG_PATH"

echo "OK: mockup-approved-${ISSUE_NUM}.flag を書き込みました"
echo "  path: $FLAG_PATH"
echo "  time: $NOW (30 分間有効)"
