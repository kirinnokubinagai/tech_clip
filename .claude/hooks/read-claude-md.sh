#!/bin/bash
# Stop hook: CLAUDE.md のルール遵守をリマインドする
# CLAUDE.md全文は出力しない（システムが自動で読み込み済みのため）

REPO_ROOT=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." && pwd 2>/dev/null) || exit 0

if [[ ! -f "${REPO_ROOT}/CLAUDE.md" ]]; then
  exit 0
fi

echo "CLAUDE.md のルールを遵守すること。worktree必須・TDD・レビュー必須・mainは常にクリーン。"
