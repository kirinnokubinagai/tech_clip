#!/usr/bin/env bash
#
# PostToolUse hook: AskUserQuestion 後に一時フラグを作成する
#
# orchestrator-flow-guard.sh が 'gh issue close' 前に確認を要求するため、
# AskUserQuestion 実行直後にフラグを作成して 5 分間有効にする。
# タイムスタンプは orchestrator-flow-guard.sh 側で検証する。
#
# 設定: {"matcher": {"tool_name": "AskUserQuestion"}, "hooks": [{"type": "PostToolUse", "command": "bash .claude/hooks/post-ask-user-question.sh"}]}

set -euo pipefail

# orchestrator-flow-guard.sh と同じパス解決ロジックを使用する
# CLAUDE_USER_ROOT はテスト時にオーバーライド可能（デフォルト: REPO_ROOT/.claude-user）
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CLAUDE_USER_ROOT="${CLAUDE_USER_ROOT:-${REPO_ROOT}/.claude-user}"
FLAG_DIR="${CLAUDE_USER_ROOT}/projects"

# プロジェクトメモリディレクトリを探す
PROJECT_MEMORY_DIR=$(ls -d "${FLAG_DIR}"/*/memory 2>/dev/null | head -1)

if [ -z "$PROJECT_MEMORY_DIR" ]; then
  # フォールバック: 最初のプロジェクトディレクトリにメモリディレクトリを作成
  FIRST_PROJECT=$(ls -d "${FLAG_DIR}"/*/ 2>/dev/null | head -1)
  if [ -n "$FIRST_PROJECT" ]; then
    PROJECT_MEMORY_DIR="${FIRST_PROJECT}memory"
    mkdir -p "$PROJECT_MEMORY_DIR"
  else
    exit 0
  fi
fi

FLAG_FILE="${PROJECT_MEMORY_DIR}/tmp-last-askuserquestion.flag"

# 現在のタイムスタンプを書き込む（orchestrator-flow-guard.sh が 5 分以内か検証する）
date -u +%Y-%m-%dT%H:%M:%SZ > "$FLAG_FILE"
