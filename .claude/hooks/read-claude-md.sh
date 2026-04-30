#!/usr/bin/env bash
# SessionStart hook: ワークフローリマインダーのみ注入（CLAUDE.md / rules の内容は Claude Code が自動ロード済みのため再注入しない）

set -euo pipefail

MESSAGE='⚠️ ワークフロー必須:
- Issue 確認/作成 → Worktree 作成 → 4 体セット spawn (analyst + 実装系 + e2e-reviewer + reviewer)
- 実装系 → impl-ready は **必ず e2e-reviewer に**送る (reviewer 直送禁止)
- 詳細は CLAUDE.md の「状況別ランブック」と harness-* skill を参照'

if command -v jq >/dev/null 2>&1; then
  jq -n --arg msg "$MESSAGE" \
    '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}'
  exit 0
fi

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"${MESSAGE//$'\n'/\\n}\"}}"
