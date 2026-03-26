#!/bin/bash
# PreToolUse hook: git push/commit時に環境変数・シークレットの漏洩を検知

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# git push or git commit のみチェック
if ! echo "$COMMAND" | grep -qE '^\s*git\s+(push|commit)'; then
  exit 0
fi

# Staged files をチェック（commitの場合）/ HEAD..origin差分をチェック（pushの場合）
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
cd "$REPO_ROOT" || exit 0

# チェック対象のファイル内容を取得
if echo "$COMMAND" | grep -q 'git commit'; then
  FILES_CONTENT=$(git diff --cached --diff-filter=ACMR 2>/dev/null)
elif echo "$COMMAND" | grep -q 'git push'; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  FILES_CONTENT=$(git diff origin/main..HEAD 2>/dev/null)
else
  exit 0
fi

# シークレットパターン検知
PATTERNS=(
  'ANTHROPIC_API_KEY\s*='
  'OPENAI_API_KEY\s*='
  'STRIPE_API_KEY\s*='
  'STRIPE_SECRET_KEY\s*='
  'DATABASE_URL\s*=\s*["\x27]?(postgres|mysql|sqlite)'
  'JWT_SECRET\s*='
  'AWS_SECRET_ACCESS_KEY\s*='
  'GOOGLE_CLIENT_SECRET\s*='
  'GITHUB_TOKEN\s*='
  'TURSO_AUTH_TOKEN\s*='
  'TURSO_DATABASE_URL\s*='
  'RESEND_API_KEY\s*='
  'BETTER_AUTH_SECRET\s*='
  'CLOUDFLARE_API_TOKEN\s*='
  'REVENUE_CAT_API_KEY\s*='
  'ADMOB_APP_ID\s*='
  'SENTRY_DSN\s*='
  'sk_live_'
  'sk_test_'
  'sk-[a-zA-Z0-9]{20,}'
  'ghp_[a-zA-Z0-9]{36}'
  'gho_[a-zA-Z0-9]{36}'
  'xoxb-[a-zA-Z0-9]+'
  'eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.'
)

FOUND=""
for PATTERN in "${PATTERNS[@]}"; do
  MATCH=$(echo "$FILES_CONTENT" | grep -nEi "$PATTERN" | head -3)
  if [ -n "$MATCH" ]; then
    FOUND="${FOUND}\n  - Pattern: ${PATTERN}\n    ${MATCH}"
  fi
done

if [ -n "$FOUND" ]; then
  MSG="シークレット・環境変数が検出されました。pushを中止してください。\n検出パターン:${FOUND}\n\n環境変数は .env ファイル（.gitignoreで除外済み）に格納してください。"
  echo "{\"decision\":\"block\",\"reason\":\"$(echo -e "$MSG" | tr '\n' ' ')\"}"
  exit 0
fi
