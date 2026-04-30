#!/usr/bin/env bash
# DB migration + static seed
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../lib/nix.sh
source "${REPO_ROOT}/scripts/lib/nix.sh"
ensure_nix_shell "${REPO_ROOT}" "$@"

# migrate.sh に移譲（turso 起動チェック・drizzle-kit migrate）
bash "${REPO_ROOT}/scripts/dev/migrate.sh"

cd "$REPO_ROOT/apps/api"

export TURSO_DATABASE_URL="${TURSO_DATABASE_URL:-http://127.0.0.1:8888}"
export TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN:-}"

if [ -f scripts/seed-maestro-static.ts ]; then
  echo "[seed] maestro static users"
  pnpm tsx scripts/seed-maestro-static.ts
else
  echo "[skip] scripts/seed-maestro-static.ts が未作成。seed をスキップ"
fi

echo "=== Migration + seed complete ==="
