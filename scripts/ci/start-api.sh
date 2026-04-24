#!/usr/bin/env bash
# CI 用 Wrangler dev API サーバー起動スクリプト
# nohup でバックグラウンド起動し、ヘルスチェックで準備完了を待つ。
#
# 使用法:
#   bash scripts/ci/start-api.sh
#
# 環境変数:
#   API_CI_PORT  (デフォルト: 18787)
# shellcheck shell=bash
set -euo pipefail

PORT="${API_CI_PORT:-18787}"

# 最大待機回数（2秒 x 30 = 60秒）
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "[api-ci] Wrangler dev API サーバーを起動します (port=${PORT})"

# wrangler は nix dev shell に含まれる。apps/api/.dev.vars から秘密値を自動読み込み
nohup nix develop --command bash -c \
  "cd apps/api && wrangler dev --port ${PORT} --ip 0.0.0.0" \
  > /tmp/api-ci.log 2>&1 &
API_PID=$!
echo "${API_PID}" > /tmp/api-ci.pid
echo "[api-ci] PID ${API_PID} で起動しました"

echo "[api-ci] 起動完了を待機中..."
for i in $(seq 1 "${MAX_RETRIES}"); do
  if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/health"; then
    echo "[api-ci] API health check 成功 (${i}回目の試行)"
    exit 0
  fi
  echo "[api-ci] 待機中... (${i}/${MAX_RETRIES})"
  sleep "${RETRY_INTERVAL}"
done

echo "[api-ci] ERROR: Wrangler dev サーバーが ${MAX_RETRIES} 回試行後も起動しませんでした"
echo "[api-ci] ログ:"
cat /tmp/api-ci.log || true
exit 1
