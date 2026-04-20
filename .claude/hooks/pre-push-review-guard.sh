#!/bin/bash
# PreToolUse:Bash hook: git push前にローカルレビュー完了を強制
#
# 修正: git rev-parse --show-toplevel はシェルCWDに依存するため、
# pushコマンドのブランチ名から git worktree list でworktreeパスを特定する。

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

# pushコマンドからブランチ名を抽出する
# 例: "git push origin issue/764/foo" -> "issue/764/foo"
# 例: "git push -u origin issue/764/foo" -> "issue/764/foo"
# 例: "git push --set-upstream origin issue/764/foo" -> "issue/764/foo"
extract_branch_from_push() {
  local cmd="$1"
  local args
  args=$(echo "$cmd" | sed 's/.*git push[[:space:]]*//')
  args=$(echo "$args" | sed 's/ -[^ ]*//g; s/ --[^ ]*//g')
  echo "$args" | awk '{print $NF}'
}

# ブランチ名に対応するworktreeパスを git worktree list から特定する
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

MARKER="${WORKTREE_PATH}/.claude/.review-passed"

if [ ! -f "$MARKER" ]; then
  echo "DENY: ローカルレビューが完了していません。pushできません。" >&2
  echo "  reviewer / infra-reviewer / ui-reviewer エージェントでレビューを実行し、全件PASSしてからpushしてください。" >&2
  echo "  レビュー完了後、マーカーファイルが自動作成されます: ${MARKER}" >&2
  exit 2
fi

MARKER_SHA=$(cat "$MARKER" | tr -d '[:space:]')
CURRENT_SHA=$(git -C "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo "")

if [ -n "$CURRENT_SHA" ] && [ "$MARKER_SHA" != "$CURRENT_SHA" ]; then
  echo "DENY: review-passed マーカー ($MARKER_SHA) は現在の HEAD ($CURRENT_SHA) と一致しません。" >&2
  echo "  レビュー以降に新しい commit があります。再レビューしてください。" >&2
  exit 2
fi

exit 0
