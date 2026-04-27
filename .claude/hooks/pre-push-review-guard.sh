#!/bin/bash
# PreToolUse:Bash hook: git push前にローカルレビュー完了を強制
#
# .claude/.review-passed を JSON として読み:
#   - head_sha == git HEAD
#   - lint_status / typecheck_status / tests 全 PASS
# 不一致 / 不在 → exit 2

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

MARKER="${WORKTREE_PATH}/.claude/.review-passed"

if [ ! -f "$MARKER" ]; then
  echo "DENY: ローカルレビューが完了していません。pushできません。" >&2
  echo "  bash scripts/gate/create-review-marker.sh --agent <your-agent-name> を実行してください。" >&2
  echo "  マーカーファイル: ${MARKER}" >&2
  exit 2
fi

# JSON マーカー対応 (旧形式 = 40byte SHA 文字列も許容)
if command -v jq &>/dev/null; then
  MARKER_TYPE=$(jq -r 'type' "$MARKER" 2>/dev/null || echo "string")
else
  MARKER_TYPE="unknown"
fi

if [ "$MARKER_TYPE" = "object" ]; then
  # 新 JSON 形式
  MARKER_SHA=$(jq -r '.head_sha // empty' "$MARKER" 2>/dev/null || echo "")
  LINT_STATUS=$(jq -r '.lint_status // "UNKNOWN"' "$MARKER" 2>/dev/null || echo "UNKNOWN")
  TYPECHECK_STATUS=$(jq -r '.typecheck_status // "UNKNOWN"' "$MARKER" 2>/dev/null || echo "UNKNOWN")
  TEST_COVERAGE_STATUS=$(jq -r '.test_coverage_status // "UNKNOWN"' "$MARKER" 2>/dev/null || echo "UNKNOWN")
else
  # 旧形式 (SHA のみ) — 後方互換
  MARKER_SHA=$(cat "$MARKER" | tr -d '[:space:]')
  LINT_STATUS="PASS"
  TYPECHECK_STATUS="PASS"
  TEST_COVERAGE_STATUS="PASS"
fi

if [ "$MARKER_SHA" != "$CURRENT_SHA" ]; then
  echo "DENY: review-passed マーカー ($MARKER_SHA) は現在の HEAD ($CURRENT_SHA) と一致しません。" >&2
  echo "  レビュー以降に新しい commit があります。再度 create-review-marker.sh を実行してください。" >&2
  exit 2
fi

if [ "$LINT_STATUS" != "PASS" ]; then
  echo "DENY: review marker の lint_status が PASS ではありません: $LINT_STATUS" >&2
  exit 2
fi

if [ "$TYPECHECK_STATUS" != "PASS" ]; then
  echo "DENY: review marker の typecheck_status が PASS ではありません: $TYPECHECK_STATUS" >&2
  exit 2
fi

if [ "$TEST_COVERAGE_STATUS" != "PASS" ]; then
  echo "DENY: review marker の test_coverage_status が PASS ではありません: $TEST_COVERAGE_STATUS" >&2
  echo "  変更ファイルに対応する test ファイルを追加してから create-review-marker.sh を再実行してください。" >&2
  exit 2
fi

exit 0
