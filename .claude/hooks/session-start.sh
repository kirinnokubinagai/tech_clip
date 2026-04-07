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
    if git diff --quiet && git diff --cached --quiet; then
      if git pull --ff-only --quiet origin main 2>/dev/null; then
        echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"mainブランチを自動pullしました（最新に同期済み）"}}'
      else
        echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"⚠️ mainブランチのfast-forward pullに失敗しました。ローカルmainがリモートと乖離しています。ユーザーに git switch -C main origin/main --discard-changes の実行を依頼してください。"}}'
      fi
    else
      echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"⚠️ mainブランチに未コミットの変更があります。mainは常にクリーンであるべきです。ユーザーに報告してください。"}}'
    fi
  fi
fi
