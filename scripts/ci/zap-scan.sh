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
#
# ※ BETTER_AUTH_SECRET / ZAP_TEST_EMAIL / ZAP_TEST_PASSWORD が未設定の場合は
#   CI用ダミー値が自動生成される（secrets 未設定環境での動作保証）

set -euo pipefail

# ============================================================================
# 設計メモ: AI エンドポイントの ZAP スキャンカバレッジ
# ============================================================================
# wrangler dev --local では AI binding が "not supported" になるため、
# /api/articles/:id/summary と /api/articles/:id/translate は 500 を返す。
# 結果として ZAP は AI エンドポイントの POST/GET ペイロードに対して
# 実質的なセキュリティ検証ができない。これは既知の制約である。
#
# このギャップを埋めるには以下のいずれかが必要:
#   1. Staging デプロイ後に追加で ZAP スキャンを行う
#   2. AI エンドポイント専用の統合テスト（既に tests/api/integration に存在）
#   3. 手動でのセキュリティテスト（リリース前チェックリスト）
#
# 実装側では routes/summary.ts と routes/ai.ts の catch ブロックが常に
# 定数エラーメッセージを返す設計を維持すること（.zap/rules.tsv の
# 10023/90022 WARN 免除はこの前提で有効）。
# ============================================================================

# 必ずリポジトリルートで実行される前提
cd "$(git rev-parse --show-toplevel)"

API_PORT=8787
# スキャン全体の最大実行時間（分）
MAX_SCAN_DURATION_MINS=5
# 1ルールあたりの最大実行時間（分）
MAX_RULE_DURATION_MINS=1
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

# --local を付けないと AI binding (remote mode) のために CLOUDFLARE_API_TOKEN が必須になる。
# ZAP スキャンは AI エンドポイントを実際に叩く必要はなく、API サーバの起動だけが目的なのでローカルモードで十分。
# NOTE: wrangler 4.77.0 で動作確認済み。--local フラグの廃止は wrangler のリリースノートを確認すること。
#       廃止された場合は wrangler dev --env <env> 相当の代替手段を検討する。
: "${BETTER_AUTH_SECRET:=$(openssl rand -hex 32)}"
: "${ZAP_TEST_EMAIL:="zap-test-$(openssl rand -hex 4)@example.com"}"
: "${ZAP_TEST_PASSWORD:="ZapTest$(openssl rand -hex 8)!"}"

TURSO_DATABASE_URL="${TURSO_DATABASE_URL}" \
TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN}" \
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET}" \
ENVIRONMENT="${ENVIRONMENT}" \
  pnpm --filter @tech-clip/api exec wrangler dev --port "${API_PORT}" --local > /tmp/api.log 2>&1 &

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

# スキャン時間上限を設定（タイムアウト防止）
ZAP_DURATION_RESULT=$(curl -s "http://localhost:${ZAP_PORT}/JSON/ascan/action/setOptionMaxScanDurationInMins/" \
  --data-urlencode "apikey=${ZAP_API_KEY}" \
  --data-urlencode "Integer=${MAX_SCAN_DURATION_MINS}")
if ! printf '%s' "${ZAP_DURATION_RESULT}" | jq -e '.Result == "OK"' > /dev/null 2>&1; then
  echo "::error::スキャン全体時間上限の設定に失敗しました: ${ZAP_DURATION_RESULT}"
  exit 1
fi
echo "setOptionMaxScanDurationInMins: ${ZAP_DURATION_RESULT}" >> "${SETUP_LOG}"

ZAP_RULE_RESULT=$(curl -s "http://localhost:${ZAP_PORT}/JSON/ascan/action/setOptionMaxRuleDurationInMins/" \
  --data-urlencode "apikey=${ZAP_API_KEY}" \
  --data-urlencode "Integer=${MAX_RULE_DURATION_MINS}")
if ! printf '%s' "${ZAP_RULE_RESULT}" | jq -e '.Result == "OK"' > /dev/null 2>&1; then
  echo "::error::スキャンルール時間上限の設定に失敗しました: ${ZAP_RULE_RESULT}"
  exit 1
fi
echo "setOptionMaxRuleDurationInMins: ${ZAP_RULE_RESULT}" >> "${SETUP_LOG}"

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
