#!/usr/bin/env bash
# ZAP セキュリティスキャンスクリプト
#
# 環境変数（CI ワークフローの env: ブロックから渡される）:
#   ZAP_PORT             - ZAP デーモンが使用するポート番号
#   ZAP_TEST_EMAIL       - テストユーザーのメールアドレス
#   ZAP_TEST_PASSWORD    - テストユーザーのパスワード
#   TURSO_DATABASE_URL   - Turso データベース URL
#   TURSO_AUTH_TOKEN     - Turso 認証トークン
#   BETTER_AUTH_SECRET   - Better Auth シークレット
#   ENVIRONMENT          - 実行環境名

set -euo pipefail

# 必ずリポジトリルートで実行される前提
cd "$(git rev-parse --show-toplevel)"

API_PORT=8787
ZAP_HOME=$(mktemp -d)
SETUP_LOG=/tmp/zap-setup.log
touch "${SETUP_LOG}"

cleanup() {
  pkill -f "wrangler dev" 2>/dev/null || true
  # shellcheck disable=SC2153
  pkill -f -- "-daemon -port ${ZAP_PORT}" 2>/dev/null || true
  rm -rf "${ZAP_HOME}"
}
trap cleanup EXIT

TURSO_DATABASE_URL="${TURSO_DATABASE_URL}" \
TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN}" \
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET}" \
ENVIRONMENT="${ENVIRONMENT}" \
  pnpm --filter @tech-clip/api exec wrangler dev --port "${API_PORT}" > /tmp/api.log 2>&1 &

ZAP_API_KEY=$(openssl rand -hex 16)

mkdir -p "${ZAP_HOME}/.ZAP"
HOME="${ZAP_HOME}" zap -daemon -port "${ZAP_PORT}" \
  -config api.key="${ZAP_API_KEY}" \
  -config log.level=INFO \
  > /tmp/zap-daemon.log 2>&1 &

echo "APIサーバー起動待機中..."
for _i in $(seq 1 30); do
  curl -s "http://localhost:${API_PORT}/health" > /dev/null 2>&1 && break
  sleep 1
done
if ! curl -s "http://localhost:${API_PORT}/health" > /dev/null 2>&1; then
  echo "::error::APIサーバーが30秒以内に起動しませんでした"
  grep -v -iE 'secret|token|password|auth' /tmp/api.log || true
  exit 1
fi

(cd apps/api && pnpm exec drizzle-kit migrate >> "${SETUP_LOG}" 2>&1)

SIGNUP_BODY=$(jq -cn \
  --arg email "${ZAP_TEST_EMAIL}" \
  --arg password "${ZAP_TEST_PASSWORD}" \
  --arg name "ZAP Test User" \
  '{email: $email, password: $password, name: $name}')
SIGNUP_STATUS=$(curl -s -o /tmp/signup.json -w "%{http_code}" \
  -X POST "http://localhost:${API_PORT}/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "${SIGNUP_BODY}")
if [ "${SIGNUP_STATUS}" != "200" ] && [ "${SIGNUP_STATUS}" != "201" ] && [ "${SIGNUP_STATUS}" != "409" ]; then
  echo "::warning::ZAPテストユーザー登録が失敗しました（HTTP ${SIGNUP_STATUS}）。未認証スキャンのみ実施します。"
fi
echo "sign-up: HTTP ${SIGNUP_STATUS}" >> "${SETUP_LOG}"

SIGNIN_BODY=$(jq -cn \
  --arg email "${ZAP_TEST_EMAIL}" \
  --arg password "${ZAP_TEST_PASSWORD}" \
  '{email: $email, password: $password}')
RESPONSE=$(curl -s -X POST "http://localhost:${API_PORT}/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "${SIGNIN_BODY}")
TOKEN=$(echo "${RESPONSE}" | jq -r '.token // .data.token // .data.session.token // empty' 2>/dev/null || echo "")
if [ -n "${TOKEN}" ]; then
  echo "::add-mask::${TOKEN}"
  echo "::add-mask::Bearer ${TOKEN}"
  echo "sign-in: トークン取得成功" >> "${SETUP_LOG}"
else
  echo "sign-in: トークン取得失敗" >> "${SETUP_LOG}"
fi

echo "ZAPデーモン起動待機中..."
for _i in $(seq 1 60); do
  curl -s "http://localhost:${ZAP_PORT}/JSON/core/view/version/?apikey=${ZAP_API_KEY}" > /dev/null 2>&1 && break
  sleep 1
done
if ! curl -s "http://localhost:${ZAP_PORT}/JSON/core/view/version/?apikey=${ZAP_API_KEY}" > /dev/null 2>&1; then
  echo "::error::ZAPデーモンが60秒以内に起動しませんでした"
  cat /tmp/zap-daemon.log
  exit 1
fi

curl -s "http://localhost:${ZAP_PORT}/JSON/openapi/action/importUrl/" \
  --data-urlencode "apikey=${ZAP_API_KEY}" \
  --data-urlencode "url=http://localhost:${API_PORT}/openapi.json" >> "${SETUP_LOG}" 2>&1
if [ -n "${TOKEN}" ]; then
  ( set +x
    curl -s "http://localhost:${ZAP_PORT}/JSON/replacer/action/addRule/?apikey=${ZAP_API_KEY}" \
      --data-urlencode "description=Auth Header" \
      --data-urlencode "enabled=true" \
      --data-urlencode "matchType=REQ_HEADER" \
      --data-urlencode "matchRegex=false" \
      --data-urlencode "matchString=Authorization" \
      --data-urlencode "replacement=Bearer ${TOKEN}" \
      --data-urlencode "initiators=" > /dev/null 2>&1
  )
fi

echo "アクティブスキャン実行中..."
SCAN_ID=$(curl -s "http://localhost:${ZAP_PORT}/JSON/ascan/action/scan/" \
  --data-urlencode "apikey=${ZAP_API_KEY}" \
  --data-urlencode "url=http://localhost:${API_PORT}" \
  --data-urlencode "recurse=true" | jq -r '.scan')
[ -n "${SCAN_ID}" ] || { echo "::error::スキャンIDの取得に失敗しました"; exit 1; }

SCAN_TIMED_OUT=1
for _i in $(seq 1 180); do
  STATUS=$(curl -s "http://localhost:${ZAP_PORT}/JSON/ascan/view/status/?scanId=${SCAN_ID}&apikey=${ZAP_API_KEY}" | jq -r '.status')
  if [ "${STATUS}" = "100" ]; then
    SCAN_TIMED_OUT=0
    break
  fi
  sleep 2
done
if [ "${SCAN_TIMED_OUT}" -eq 1 ]; then
  echo "::error::ZAPスキャンがタイムアウトしました（360秒）"
  exit 1
fi

mkdir -p .zap
curl -s "http://localhost:${ZAP_PORT}/OTHER/core/other/htmlreport/?apikey=${ZAP_API_KEY}" > .zap/zap-report.html

echo "スキャン結果を確認中..."
if [ -f ".zap/rules.tsv" ]; then
  HIGH=$(curl -s "http://localhost:${ZAP_PORT}/JSON/alert/view/alerts/?baseurl=http://localhost:${API_PORT}&riskId=3&apikey=${ZAP_API_KEY}" \
    | jq -r --slurpfile rules <(awk -F"\t" '$2 == "IGNORE" || $2 == "WARN" {print $1}' .zap/rules.tsv | jq -R . | jq -s .) \
    '[.alerts[] | select(.pluginId as $id | $rules[0] | index($id) | not)] | length')
  MEDIUM=$(curl -s "http://localhost:${ZAP_PORT}/JSON/alert/view/alerts/?baseurl=http://localhost:${API_PORT}&riskId=2&apikey=${ZAP_API_KEY}" \
    | jq -r --slurpfile rules <(awk -F"\t" '$2 == "IGNORE" || $2 == "WARN" {print $1}' .zap/rules.tsv | jq -R . | jq -s .) \
    '[.alerts[] | select(.pluginId as $id | $rules[0] | index($id) | not)] | length')
else
  HIGH=$(curl -s "http://localhost:${ZAP_PORT}/JSON/alert/view/alertsSummary/?baseurl=http://localhost:${API_PORT}&apikey=${ZAP_API_KEY}" | jq -r '.alertsSummary.High // 0')
  MEDIUM=$(curl -s "http://localhost:${ZAP_PORT}/JSON/alert/view/alertsSummary/?baseurl=http://localhost:${API_PORT}&apikey=${ZAP_API_KEY}" | jq -r '.alertsSummary.Medium // 0')
fi

if [ "${HIGH:-0}" -gt 0 ] || [ "${MEDIUM:-0}" -gt 0 ]; then
  echo "::error::セキュリティ問題検出（High: ${HIGH}, Medium: ${MEDIUM}）"
  exit 1
fi
echo "ZAPスキャン完了: 問題なし"
