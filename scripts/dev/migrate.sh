#!/usr/bin/env bash
# ローカル Turso (turso dev / sqld) に対して drizzle-kit migrate を実行する
#
# 前提: pnpm dev:e2e:up で turso dev が起動済みであること
#
# 使い方:
#   pnpm dev:migrate          # 通常
#   SQLD_PORT=9999 pnpm dev:migrate  # ポート変更時
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../lib/nix.sh
source "${REPO_ROOT}/scripts/lib/nix.sh"
ensure_nix_shell "${REPO_ROOT}" "$@"

SQLD_PORT="${SQLD_PORT:-8888}"
TURSO_URL="http://127.0.0.1:${SQLD_PORT}"

# turso dev / sqld が起動しているか確認
if ! lsof -i:"${SQLD_PORT}" 2>/dev/null | grep -q LISTEN; then
  echo "ERROR: local Turso が起動していません（:${SQLD_PORT}）"
  echo "       先に 'pnpm dev:e2e:up' を実行してください"
  exit 1
fi

cd "$REPO_ROOT/apps/api"

export TURSO_DATABASE_URL="${TURSO_DATABASE_URL:-${TURSO_URL}}"
# ローカル turso dev は認証不要だが drizzle-kit は空文字を拒否するため dummy を使う
export TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN:-dummy}"

echo "[migrate] target: ${TURSO_DATABASE_URL}"
pnpm drizzle-kit migrate

echo "=== Migration complete ==="
