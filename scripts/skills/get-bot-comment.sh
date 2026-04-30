#!/usr/bin/env bash
# bot レビューコメント取得スクリプト
# 使用方法: PR_NUMBER=<n> bash scripts/skills/get-bot-comment.sh
# 終了コード: 0=取得成功, 1=コメント未発見
set -uo pipefail

PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"

BOT_BODY=$(gh pr view "$PR_NUMBER" --json comments --jq \
  '[.comments[] | select(.body | contains("## PRレビュー結果"))] | last | .body' 2>/dev/null || echo "")

if [ -z "$BOT_BODY" ]; then
  echo "NOT_FOUND:no_review_comment"
  exit 1
fi

echo "$BOT_BODY"
exit 0
