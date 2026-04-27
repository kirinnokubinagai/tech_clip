#!/bin/bash
# PreToolUse:Bash hook: git push前にE2E通過を強制
#
# E2E影響ファイル（mobile components / maestro yaml / testID / locales）を含む push は
# .claude/.e2e-passed マーカーと HEAD SHA の一致が必須。
# 不一致またはマーカー不在なら exit 2 で push をブロックする。

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

# pushコマンドからブランチ名を抽出する（pre-push-review-guard.sh と同じロジック）
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

# HEAD と origin の差分ファイル一覧を取得
DIFF_FILES=$(git -C "$WORKTREE_PATH" diff origin/main...HEAD --name-only 2>/dev/null || \
             git -C "$WORKTREE_PATH" diff HEAD~1...HEAD --name-only 2>/dev/null || echo "")

if [ -z "$DIFF_FILES" ]; then
  exit 0
fi

# E2E影響ファイルパターンに該当するか確認
E2E_AFFECTED=0

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    apps/mobile/src/components/*)      E2E_AFFECTED=1; break ;;
    apps/mobile/app/*)                  E2E_AFFECTED=1; break ;;
    tests/e2e/maestro/*)                E2E_AFFECTED=1; break ;;
    apps/mobile/src/locales/*)          E2E_AFFECTED=1; break ;;
    apps/mobile/app/locales/*)          E2E_AFFECTED=1; break ;;
    *locales/*)                         E2E_AFFECTED=1; break ;;
  esac
done <<< "$DIFF_FILES"

# testID 文字列を含む変更ファイルもチェック
if [ "$E2E_AFFECTED" -eq 0 ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    FULL_PATH="$WORKTREE_PATH/$file"
    if [ -f "$FULL_PATH" ]; then
      if grep -q "testID" "$FULL_PATH" 2>/dev/null; then
        E2E_AFFECTED=1
        break
      fi
    fi
  done <<< "$DIFF_FILES"
fi

# E2E影響なし → 通過
if [ "$E2E_AFFECTED" -eq 0 ]; then
  exit 0
fi

# E2E影響あり → マーカー確認
MARKER="${WORKTREE_PATH}/.claude/.e2e-passed"

if [ ! -f "$MARKER" ]; then
  echo "DENY: E2E 未確認のため push できません。" >&2
  echo "  このブランチには E2E 影響あり（mobile components / maestro yaml / testID / locales）の変更が含まれています。" >&2
  echo "  e2e-reviewer に impl-ready を送って e2e-approved を取得してください。" >&2
  echo "  マーカーファイル: ${MARKER}" >&2
  exit 2
fi

MARKER_SHA=$(cat "$MARKER" | tr -d '[:space:]')

if [ "$MARKER_SHA" != "$CURRENT_SHA" ]; then
  echo "DENY: .e2e-passed マーカー ($MARKER_SHA) は現在の HEAD ($CURRENT_SHA) と一致しません。" >&2
  echo "  E2E 確認後に新しい commit があります。再度 e2e-reviewer に impl-ready を送ってください。" >&2
  exit 2
fi

exit 0
