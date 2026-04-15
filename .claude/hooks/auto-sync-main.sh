#!/bin/bash
# SessionStart hook: main worktree と現 worktree を origin/main へ自動 sync

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT"

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# uncommitted changes があるときは安全のためスキップ
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"[auto-sync] uncommitted changes あり。sync をスキップ"}}'
  exit 0
fi

MESSAGES=""

# --- 1. main worktree の FF merge ---
COMMON_GIT_DIR=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "")
if [ -n "$COMMON_GIT_DIR" ]; then
  MAIN_WT_ROOT=$(cd "${COMMON_GIT_DIR}/.." 2>/dev/null && pwd -P || echo "")
  if [ -n "$MAIN_WT_ROOT" ] && [ -d "$MAIN_WT_ROOT" ] && [ "$MAIN_WT_ROOT" != "$REPO_ROOT" ]; then
    git -C "$MAIN_WT_ROOT" fetch origin main --quiet 2>/dev/null || true
    MAIN_LOCAL=$(git -C "$MAIN_WT_ROOT" rev-parse HEAD 2>/dev/null || echo "")
    MAIN_REMOTE=$(git -C "$MAIN_WT_ROOT" rev-parse origin/main 2>/dev/null || echo "")
    if [ -n "$MAIN_LOCAL" ] && [ -n "$MAIN_REMOTE" ] && [ "$MAIN_LOCAL" != "$MAIN_REMOTE" ]; then
      MAIN_DIRTY=$(git -C "$MAIN_WT_ROOT" status --porcelain 2>/dev/null | grep -v '^??' | head -1 || echo "")
      if [ -z "$MAIN_DIRTY" ]; then
        if git -C "$MAIN_WT_ROOT" merge --ff-only origin/main --quiet 2>/dev/null; then
          MESSAGES="${MESSAGES}[auto-sync] main worktree を origin/main へ FF merge しました。"
        else
          MESSAGES="${MESSAGES}[auto-sync] ⚠️ main worktree の FF merge 失敗（non-FF 状態）。"
        fi
      fi
    fi
  elif [ "$MAIN_WT_ROOT" = "$REPO_ROOT" ]; then
    CURRENT_MAIN_BRANCH=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "")
    if [ "$CURRENT_MAIN_BRANCH" = "main" ]; then
      git fetch origin main --quiet 2>/dev/null || true
      LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "")
      REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "")
      if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
        if git merge --ff-only origin/main --quiet 2>/dev/null; then
          MESSAGES="${MESSAGES}[auto-sync] main を origin/main へ FF merge しました。"
        else
          MESSAGES="${MESSAGES}[auto-sync] ⚠️ main の FF merge 失敗。"
        fi
      fi
    fi
  fi
fi

# --- 2. 現 worktree の 3-way merge（issue/* branch のみ）---
if [[ "$CURRENT_BRANCH" =~ ^issue/ ]]; then
  git fetch origin main --quiet 2>/dev/null || true
  BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
  if [ "$BEHIND" -gt 0 ]; then
    MESSAGES="${MESSAGES}[auto-sync] origin/main が ${BEHIND} commit 進んでいます。merge を試行..."
    if git merge origin/main --no-edit --no-ff --quiet 2>/dev/null; then
      MESSAGES="${MESSAGES} merge 成功。"
    else
      git merge --abort 2>/dev/null || true
      MESSAGES="${MESSAGES} ⚠️ conflict 発生。merge を abort しました。手動解消が必要です。"
    fi
  fi
fi

if [ -n "$MESSAGES" ]; then
  if command -v jq &>/dev/null; then
    JSON=$(jq -n --arg msg "$MESSAGES" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}')
    echo "$JSON"
  else
    SAFE_MSG=$(printf '%s' "$MESSAGES" | tr -d '"\\' | tr -d '\n\r\t')
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"${SAFE_MSG}\"}}"
  fi
fi

exit 0
