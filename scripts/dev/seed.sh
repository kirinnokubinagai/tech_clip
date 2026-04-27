#!/usr/bin/env bash
# DB migration + static seed
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../lib/nix.sh
source "${REPO_ROOT}/scripts/lib/nix.sh"
ensure_nix_shell "${REPO_ROOT}" "$@"

cd "$REPO_ROOT/apps/api"

# turso dev が動作しているか check
if ! lsof -i:8888 2>/dev/null | grep -q LISTEN; then
  echo "ERROR: turso dev が起動していません。先に 'pnpm dev:e2e:up' を実行してください"
  exit 1
fi

export TURSO_DATABASE_URL="${TURSO_DATABASE_URL:-http://127.0.0.1:8888}"

echo "[migrate] drizzle-kit migrate"
pnpm drizzle-kit migrate

if [ -f scripts/seed-maestro-static.ts ]; then
  echo "[seed] maestro static users"
  pnpm tsx scripts/seed-maestro-static.ts
else
  echo "[skip] scripts/seed-maestro-static.ts が未作成。seed をスキップ"
fi

echo "=== Migration + seed complete ==="
