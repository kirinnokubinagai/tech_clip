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

# 最大待機回数（2秒 x 60 = 120秒）
MAX_RETRIES=60
RETRY_INTERVAL=2

echo "[api-ci] Wrangler dev API サーバーを起動します (port=${PORT})"

# CI 環境では CLOUDFLARE_API_TOKEN が必要（wrangler の非インタラクティブチェック回避）
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-dummy-ci-token}"
# アカウント ID も設定して Cloudflare API 呼び出しを回避
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-00000000000000000000000000000001}"

# apps/api/.dev.vars が存在しない場合は CI 用の値で生成する
# wrangler dev はこのファイルからシークレットを自動読み込みする
if [ ! -f "apps/api/.dev.vars" ]; then
  echo "[api-ci] apps/api/.dev.vars が見つかりません。CI 用に生成します"
  cat > apps/api/.dev.vars << EOF
ENVIRONMENT=development
TURSO_DATABASE_URL=${TURSO_DATABASE_URL:-http://127.0.0.1:8888}
TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN:-dummy}
BETTER_AUTH_SECRET=ci-e2e-better-auth-secret-for-testing-only-32chars
API_BASE_URL=http://127.0.0.1:${PORT}/api/auth
APP_URL=http://localhost:8081
TRUSTED_ORIGINS=http://localhost:8081,http://10.0.2.2:8081
RESEND_API_KEY=dummy-resend-key
FROM_EMAIL=no-reply@ci.test
REVENUECAT_WEBHOOK_SECRET=dummy-revenuecat-secret
GOOGLE_CLIENT_ID=dummy-google-client-id
GOOGLE_CLIENT_SECRET=dummy-google-client-secret
APPLE_CLIENT_ID=dummy-apple-client-id
APPLE_CLIENT_SECRET=dummy-apple-client-secret
GITHUB_CLIENT_ID=dummy-github-client-id
GITHUB_CLIENT_SECRET=dummy-github-client-secret
EOF
  echo "[api-ci] apps/api/.dev.vars 生成完了"
fi

# wrangler は nix dev shell に含まれる
# wrangler.ci.toml を使用: [ai] binding を除外して edge-preview remote proxy を回避する
# （wrangler 4.x の [ai] binding はダミー認証情報では起動に失敗する）
nohup nix develop --command bash -c \
  "cd apps/api && CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN} CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} wrangler dev --config wrangler.ci.toml --port ${PORT} --ip 0.0.0.0" \
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
