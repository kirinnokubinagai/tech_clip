#!/bin/bash
# SessionStart hook: mainブランチが最新か確認し、遅れていたら自動pull

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

BRANCH=$(git branch --show-current 2>/dev/null)

# fetch latest (quiet)
git fetch origin --quiet 2>/dev/null

if [ "$BRANCH" = "main" ]; then
  LOCAL=$(git rev-parse HEAD 2>/dev/null)
  REMOTE=$(git rev-parse origin/main 2>/dev/null)

  if [ "$LOCAL" != "$REMOTE" ]; then
    # Check for uncommitted changes
    if git diff --quiet && git diff --cached --quiet; then
      git pull --rebase --quiet origin main 2>/dev/null
      echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"mainブランチを自動pullしました（最新に同期済み）"}}'
    else
      echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"⚠️ mainブランチがリモートより遅れています。未コミットの変更があるため自動pullできません。手動で git stash && git pull && git stash pop を実行してください。"}}'
    fi
  fi
fi
