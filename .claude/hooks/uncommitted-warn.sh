#!/bin/bash
# Stop hook: セッション終了時に未コミットの変更があれば警告

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

CHANGES=$(git status --porcelain 2>/dev/null | grep -v '^??' | head -5)

if [ -n "$CHANGES" ]; then
  COUNT=$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')
  echo "{\"systemMessage\":\"⚠️ 未コミットの変更が${COUNT}件あります。コミットを忘れずに。\"}"
fi
