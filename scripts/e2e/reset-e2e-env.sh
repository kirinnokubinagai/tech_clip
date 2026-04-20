#!/usr/bin/env bash
# e2e 環境リセットスクリプト
# Turso dev サーバーの起動確認 -> DB 全削除 -> migrate -> seed を実行する。
# local pre-push と CI 両方から呼び出せる。
#
# 使用法:
#   bash scripts/e2e/reset-e2e-env.sh
#
# 環境変数:
#   TURSO_DATABASE_URL  (デフォルト: http://127.0.0.1:8888)
#   TURSO_AUTH_TOKEN    (デフォルト: dummy)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TURSO_DATABASE_URL="${TURSO_DATABASE_URL:-http://127.0.0.1:8888}"
export TURSO_DATABASE_URL
export TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN:-dummy}"

echo "[e2e-reset] Turso dev サーバー (${TURSO_DATABASE_URL}) を確認中..."

if ! curl -sf -o /dev/null --max-time 3 "${TURSO_DATABASE_URL}"; then
  echo ""
  echo "ERROR: Turso dev サーバーに接続できません (${TURSO_DATABASE_URL})"
  echo "  起動コマンド: turso dev --port 8888"
  exit 1
fi

echo "[e2e-reset] Turso dev サーバーが起動しています"

echo "[e2e-reset] DB リセット + migrate + seed を実行中..."
cd "${REPO_ROOT}"
pnpm --filter @tech-clip/api reset:e2e

echo "[e2e-reset] 完了"
