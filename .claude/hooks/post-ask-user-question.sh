#!/usr/bin/env bash
#
# PostToolUse hook: AskUserQuestion 後に一時フラグを作成する
#
# orchestrator-flow-guard.sh が 'gh issue close' 前に確認を要求するため、
# AskUserQuestion 実行直後にフラグを作成して 5 分間有効にする。
#
# 設定: {"matcher": {"tool_name": "AskUserQuestion"}, "hooks": [{"type": "PostToolUse", "command": "bash .claude/hooks/post-ask-user-question.sh"}]}

set -euo pipefail

FLAG_DIR="${HOME}/.claude-user/projects"
FLAG_PATTERN="*/memory/tmp-last-askuserquestion.flag"

# プロジェクトメモリディレクトリを探す
PROJECT_MEMORY_DIR=$(ls -d "${FLAG_DIR}"/*/memory 2>/dev/null | head -1)

if [ -z "$PROJECT_MEMORY_DIR" ]; then
  # フォールバック: 最初のプロジェクトディレクトリにメモリディレクトリを作成
  FIRST_PROJECT=$(ls -d "${FLAG_DIR}"/*/  2>/dev/null | head -1)
  if [ -n "$FIRST_PROJECT" ]; then
    PROJECT_MEMORY_DIR="${FIRST_PROJECT}memory"
    mkdir -p "$PROJECT_MEMORY_DIR"
  else
    exit 0
  fi
fi

FLAG_FILE="${PROJECT_MEMORY_DIR}/tmp-last-askuserquestion.flag"

# タイムスタンプを書き込む（5分以内のみ有効）
date -u +%Y-%m-%dT%H:%M:%SZ > "$FLAG_FILE"

# 古いフラグを自動削除（5分超過）
if [ -f "$FLAG_FILE" ]; then
  FLAG_TIME=$(cat "$FLAG_FILE" 2>/dev/null || echo "")
  if [ -n "$FLAG_TIME" ]; then
    FLAG_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$FLAG_TIME" +%s 2>/dev/null \
      || date -d "$FLAG_TIME" +%s 2>/dev/null \
      || echo 0)
    NOW_EPOCH=$(date +%s)
    ELAPSED=$((NOW_EPOCH - FLAG_EPOCH))
    if [ "$ELAPSED" -gt 300 ]; then
      rm -f "$FLAG_FILE"
    fi
  fi
fi
