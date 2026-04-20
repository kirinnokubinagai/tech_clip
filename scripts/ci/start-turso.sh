#!/usr/bin/env bash
# CI 用 Turso dev サーバー起動スクリプト
# nohup でバックグラウンド起動し、ヘルスチェックで準備完了を待つ。
#
# 使用法:
#   bash scripts/ci/start-turso.sh
#
# 環境変数:
#   TURSO_CI_DB_FILE  (デフォルト: /tmp/tech-clip-ci-turso.db)
#   TURSO_CI_PORT     (デフォルト: 8888)
# shellcheck shell=bash
set -euo pipefail

DB_FILE="${TURSO_CI_DB_FILE:-/tmp/tech-clip-ci-turso.db}"
PORT="${TURSO_CI_PORT:-8888}"

# 最大待機回数（2秒 x 30 = 60秒）
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "[turso-ci] Turso dev サーバーを起動します (port=${PORT}, db=${DB_FILE})"

nohup turso dev --port "${PORT}" --db-file "${DB_FILE}" \
  > /tmp/turso-ci.log 2>&1 &
TURSO_PID=$!
echo "${TURSO_PID}" > /tmp/turso-ci.pid
echo "[turso-ci] PID ${TURSO_PID} で起動しました"

echo "[turso-ci] 起動完了を待機中..."
for i in $(seq 1 "${MAX_RETRIES}"); do
  if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}"; then
    echo "[turso-ci] Turso dev サーバーが準備完了 (${i}回目の試行)"
    exit 0
  fi
  echo "[turso-ci] 待機中... (${i}/${MAX_RETRIES})"
  sleep "${RETRY_INTERVAL}"
done

echo "[turso-ci] ERROR: Turso dev サーバーが ${MAX_RETRIES} 回試行後も起動しませんでした"
echo "[turso-ci] ログ:"
cat /tmp/turso-ci.log || true
exit 1
