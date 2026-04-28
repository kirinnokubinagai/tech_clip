#!/bin/bash
# PreToolUse:Bash hook: git push前にローカルレビュー完了を強制
#
# .claude/.review-passed (HEAD SHA 1行) を読み:
#   - ファイル形式 = 40 文字 hex のみ (空行・JSON・余計な文字は不正)
#   - 内容 == git HEAD
# 不一致 / 不在 / 不正形式 → exit 2

extract_command_from_arguments() {
  local arguments="$1"
  local command=""

  if command -v jq &> /dev/null; then
    command=$(echo "$arguments" | jq -r '.command // empty' 2>/dev/null)
  fi

  if [ -z "$command" ]; then
    command=$(echo "$arguments" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  fi

  echo "$command"
}

COMMAND=$(extract_command_from_arguments "${ARGUMENTS:-}")

if [ -z "$COMMAND" ]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -q "git push"; then
  exit 0
fi

extract_branch_from_push() {
  local cmd="$1"
  local args
  args=$(echo "$cmd" | sed 's/.*git push[[:space:]]*//')
  args=$(echo "$args" | sed 's/ -[^ ]*//g; s/ --[^ ]*//g')
  echo "$args" | awk '{print $NF}'
}

find_worktree_for_branch() {
  local branch="$1"
  git worktree list --porcelain 2>/dev/null | awk -v b="$branch" '
    /^worktree / { wt = substr($0, 10) }
    /^branch / { br = substr($0, 8); gsub(/^refs\/heads\//, "", br); if (br == b) { print wt; exit } }
  '
}

BRANCH=$(extract_branch_from_push "$COMMAND")

WORKTREE_PATH=""
if [ -n "$BRANCH" ]; then
  WORKTREE_PATH=$(find_worktree_for_branch "$BRANCH")
fi

if [ -z "$WORKTREE_PATH" ]; then
  WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
fi

if [ -z "$WORKTREE_PATH" ]; then
  exit 0
fi

CURRENT_SHA=$(git -C "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo "")
if [ -z "$CURRENT_SHA" ]; then
  exit 0
fi

# branch 戦略 (#1138): marker 必須は stage → main の経路のみ
# feature/* / issue/* 等の通常開発 branch は CI gate に委譲 → push hook を緩める
CURRENT_BRANCH=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "stage" ] && [ "$CURRENT_BRANCH" != "main" ]; then
  exit 0
fi

MARKER="${WORKTREE_PATH}/.claude/.review-passed"

if [ ! -f "$MARKER" ]; then
  echo "DENY: ローカルレビューが完了していません。pushできません。" >&2
  echo "  bash scripts/gate/create-review-marker.sh --agent <your-agent-name> を実行してください。" >&2
  echo "  マーカーファイル: ${MARKER}" >&2
  exit 2
fi

# marker の内容を取得 (空白・改行を除去)
MARKER_CONTENT=$(tr -d '[:space:]' < "$MARKER")

# 形式検証: 40 文字 hex のみ (JSON / 空 / 余計な文字は弾く)
if ! echo "$MARKER_CONTENT" | grep -qE '^[a-f0-9]{40}$'; then
  echo "DENY: .review-passed マーカーの形式が不正です。" >&2
  echo "  HEAD SHA (40文字 hex) のみを含むファイルが期待されています。" >&2
  echo "  内容: '${MARKER_CONTENT:0:80}...'" >&2
  echo "  bash scripts/gate/create-review-marker.sh --agent <your-agent-name> で再生成してください。" >&2
  exit 2
fi

if [ "$MARKER_CONTENT" != "$CURRENT_SHA" ]; then
  echo "DENY: review-passed マーカー (${MARKER_CONTENT:0:12}) は現在の HEAD (${CURRENT_SHA:0:12}) と一致しません。" >&2
  echo "  レビュー以降に新しい commit があります。再度 create-review-marker.sh を実行してください。" >&2
  exit 2
fi

# test coverage 二重チェック (marker 作成時にも check-test-coverage.sh は実行されているが、
# .sh → .bats 等のマッピング漏れ・後付け追加を防ぐため push 直前にも再確認する)
COVERAGE_SCRIPT="${WORKTREE_PATH}/scripts/gate/check-test-coverage.sh"
if [ -f "$COVERAGE_SCRIPT" ]; then
  if ! (cd "$WORKTREE_PATH" && bash "$COVERAGE_SCRIPT" origin/main >/dev/null 2>&1); then
    echo "DENY: test coverage gate に違反する変更が含まれています。" >&2
    echo "  実装ファイル (.sh / .ts / .tsx) に対応する test ファイル (.bats / .test.ts) が必要です。" >&2
    echo "  詳細: bash scripts/gate/check-test-coverage.sh origin/main" >&2
    exit 2
  fi
fi

exit 0
