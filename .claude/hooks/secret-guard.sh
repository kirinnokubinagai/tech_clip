#!/bin/bash
# PreToolUse:Bash hook: git push/commit時にシークレット漏洩を検知

if ! command -v jq &> /dev/null; then
  exit 0
fi

COMMAND=$(echo "$ARGUMENTS" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -qE 'git\s+(push|commit)'; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
cd "$REPO_ROOT" || exit 0

FILES_CONTENT=""
if echo "$COMMAND" | grep -q 'git commit'; then
  FILES_CONTENT=$(git diff --cached --diff-filter=ACMR 2>/dev/null)
fi
if echo "$COMMAND" | grep -q 'git push'; then
  FILES_CONTENT=$(git diff origin/main..HEAD 2>/dev/null)
fi
if [ -z "$FILES_CONTENT" ]; then
  exit 0
fi

PATTERNS=(
  'RUNPOD_API_KEY\s*='
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
  echo "DENY: シークレット・環境変数が検出されました。" >&2
  echo -e "検出パターン:${FOUND}" >&2
  echo "環境変数は .env ファイル（.gitignoreで除外済み）に格納してください。" >&2
  exit 2
fi

exit 0
