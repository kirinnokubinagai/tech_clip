#!/usr/bin/env bash
# RunPod サーバーレスエンドポイントを自動プロビジョニングするスクリプト
#
# RunPod GraphQL API を使用して、Qwen 用のテンプレートとエンドポイントを作成・更新する。
#
# 使用方法:
#   RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh \
#     --type qwen --target production --image user/techclip-qwen:latest
#
# 環境変数:
#   RUNPOD_API_KEY  - RunPod API キー（必須）
#
# オプション:
#   --type    - エンドポイント種別: qwen（必須）
#   --target  - デプロイ対象: production | local（デフォルト: production）
#   --image   - Docker イメージ名（qwen の場合は必須）
#   --gpu     - GPU タイプ（デフォルト: AMPERE_24）
#   --workers - 最大ワーカー数（デフォルト: 3）
#   --dry-run - 実際には作成せず、リクエスト内容を表示する

set -euo pipefail

# =============================================================================
# 定数
# =============================================================================

# RunPod GraphQL API エンドポイント
RUNPOD_API_URL="https://api.runpod.io/graphql"

# Qwen テンプレート名
QWEN_TEMPLATE_NAME="techclip-qwen3.5-9b"

# Qwen エンドポイント名
QWEN_ENDPOINT_NAME="techclip-qwen3.5"

# デフォルト GPU タイプ（RTX 4090 = AMPERE_24）
DEFAULT_GPU="AMPERE_24"

# デフォルト最大ワーカー数
DEFAULT_MAX_WORKERS=3

# コンテナディスクサイズ（GB）
CONTAINER_DISK_GB=20

# アイドルタイムアウト（秒）
IDLE_TIMEOUT_SEC=5

# スケーラータイプ
SCALER_TYPE="QUEUE_DELAY"

# スケーラー値（秒）
SCALER_VALUE=4

# 実行タイムアウト（ミリ秒）
EXECUTION_TIMEOUT_MS=300000

# =============================================================================
# ヘルパー関数
# =============================================================================

usage() {
  cat <<'USAGE'
使用方法:
  RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh \
    --type qwen --target production --image user/techclip-qwen:latest

オプション:
  --type    エンドポイント種別: qwen（必須）
  --target  デプロイ対象: production | local（デフォルト: production）
  --image   Docker イメージ名（qwen の場合は必須）
  --gpu     GPU タイプ（デフォルト: AMPERE_24）
  --workers 最大ワーカー数（デフォルト: 3）
  --dry-run 実際には作成せず、リクエスト内容を表示する
  --help    このヘルプを表示する

環境変数:
  RUNPOD_API_KEY  RunPod API キー（必須）
USAGE
}

log_info() {
  echo "==> $1" >&2
}

log_error() {
  echo "エラー: $1" >&2
}

log_success() {
  echo "    [OK] $1" >&2
}

log_skip() {
  echo "    [SKIP] $1" >&2
}

graphql_request() {
  local query="$1"
  local response

  if ! response=$(curl --silent --fail-with-body --request POST \
    --header 'content-type: application/json' \
    --header "Authorization: Bearer ${RUNPOD_API_KEY}" \
    --url "${RUNPOD_API_URL}" \
    --data "{\"query\": $(echo "$query" | jq -Rs .)}" 2>&1); then
    log_error "RunPod API リクエストに失敗しました"
    log_error "レスポンス: ${response}"
    return 1
  fi

  local errors
  errors=$(echo "$response" | jq -r '.errors // empty')
  if [[ -n "$errors" && "$errors" != "null" ]]; then
    log_error "RunPod API がエラーを返しました:"
    echo "$response" | jq '.errors' >&2
    return 1
  fi

  echo "$response"
}

find_existing_endpoint() {
  local target_name="$1"
  local response

  response=$(graphql_request 'query { myself { endpoints { id name templateId } } }')
  if [[ $? -ne 0 ]]; then
    return 1
  fi

  echo "$response" | jq -r --arg name "$target_name" \
    '(.data.myself.endpoints // [])[] | select(.name == $name) | .id // empty'
}

find_existing_template() {
  local target_name="$1"
  local response

  response=$(graphql_request 'query { myself { serverlessTemplates { id name imageName } } }')
  if [[ $? -ne 0 ]]; then
    return 1
  fi

  echo "$response" | jq -r --arg name "$target_name" \
    '(.data.myself.serverlessTemplates // [])[] | select(.name == $name) | .id // empty'
}

create_template() {
  local template_name="$1"
  local image_name="$2"
  local env_vars="${3:-}"

  log_info "テンプレートを作成中: ${template_name}"

  local env_input=""
  if [[ -n "$env_vars" ]]; then
    env_input=", env: [${env_vars}]"
  fi

  local safe_name
  safe_name=$(echo "$template_name" | jq -Rs '.')
  local safe_image
  safe_image=$(echo "$image_name" | jq -Rs '.')

  local mutation="mutation {
    saveTemplate(input: {
      name: ${safe_name},
      imageName: ${safe_image},
      containerDiskInGb: ${CONTAINER_DISK_GB},
      isServerless: true${env_input}
    }) {
      id
      name
      imageName
    }
  }"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "    [DRY-RUN] テンプレート作成リクエスト:" >&2
    echo "    名前: ${template_name}" >&2
    echo "    イメージ: ${image_name}" >&2
    echo "dry-run-template-id"
    return 0
  fi

  local response
  response=$(graphql_request "$mutation")
  if [[ $? -ne 0 ]]; then
    log_error "テンプレートの作成に失敗しました"
    return 1
  fi

  local template_id
  template_id=$(echo "$response" | jq -r '.data.saveTemplate.id')

  if [[ -z "$template_id" || "$template_id" == "null" ]]; then
    log_error "テンプレートIDの取得に失敗しました"
    log_error "レスポンス: ${response}"
    return 1
  fi

  log_success "テンプレート作成完了 (ID: ${template_id})"
  echo "$template_id"
}

save_endpoint() {
  local endpoint_name="$1"
  local template_id="$2"
  local gpu_ids="$3"
  local max_workers="$4"
  local endpoint_id="${5:-}"

  if [[ -n "${endpoint_id}" ]]; then
    log_info "エンドポイントを更新中: ${endpoint_name}"
  else
    log_info "エンドポイントを作成中: ${endpoint_name}"
  fi

  local safe_name
  safe_name=$(echo "$endpoint_name" | jq -Rs '.')
  local safe_template_id
  safe_template_id=$(echo "$template_id" | jq -Rs '.')
  local safe_gpu_ids
  safe_gpu_ids=$(echo "$gpu_ids" | jq -Rs '.')
  local endpoint_id_input=""

  if [[ -n "${endpoint_id}" ]]; then
    local safe_endpoint_id
    safe_endpoint_id=$(echo "$endpoint_id" | jq -Rs '.')
    endpoint_id_input="id: ${safe_endpoint_id},"
  fi

  local mutation="mutation {
    saveEndpoint(input: {
      ${endpoint_id_input}
      name: ${safe_name},
      templateId: ${safe_template_id},
      gpuIds: ${safe_gpu_ids},
      workersMin: 0,
      workersMax: ${max_workers},
      idleTimeout: ${IDLE_TIMEOUT_SEC},
      scalerType: \"${SCALER_TYPE}\",
      scalerValue: ${SCALER_VALUE},
      executionTimeoutMs: ${EXECUTION_TIMEOUT_MS},
      locations: \"\"
    }) {
      id
      name
      templateId
      gpuIds
      workersMax
    }
  }"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "    [DRY-RUN] エンドポイント保存リクエスト:" >&2
    echo "    名前: ${endpoint_name}" >&2
    echo "    テンプレートID: ${template_id}" >&2
    echo "    GPU: ${gpu_ids}" >&2
    echo "    最大ワーカー: ${max_workers}" >&2
    if [[ -n "${endpoint_id}" ]]; then
      echo "    既存エンドポイントID: ${endpoint_id}" >&2
    fi
    echo "dry-run-endpoint-id"
    return 0
  fi

  local response
  response=$(graphql_request "$mutation")
  if [[ $? -ne 0 ]]; then
    log_error "エンドポイントの保存に失敗しました"
    return 1
  fi

  local endpoint_id
  endpoint_id=$(echo "$response" | jq -r '.data.saveEndpoint.id')

  if [[ -z "${endpoint_id}" || "$endpoint_id" == "null" ]]; then
    log_error "エンドポイントIDの取得に失敗しました"
    log_error "レスポンス: ${response}"
    return 1
  fi

  log_success "エンドポイント保存完了 (ID: ${endpoint_id})"
  echo "$endpoint_id"
}

# =============================================================================
# 引数パース
# =============================================================================

ENDPOINT_TYPE=""
DEPLOY_TARGET="production"
DOCKER_IMAGE=""
GPU_TYPE="${DEFAULT_GPU}"
MAX_WORKERS="${DEFAULT_MAX_WORKERS}"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      ENDPOINT_TYPE="$2"
      shift 2
      ;;
    --target)
      DEPLOY_TARGET="$2"
      shift 2
      ;;
    --image)
      DOCKER_IMAGE="$2"
      shift 2
      ;;
    --gpu)
      GPU_TYPE="$2"
      shift 2
      ;;
    --workers)
      if [[ ! "$2" =~ ^[0-9]+$ ]]; then
        log_error "--workers は数値を指定してください"
        exit 1
      fi
      MAX_WORKERS="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      log_error "不明なオプション: $1"
      usage
      exit 1
      ;;
  esac
done

# =============================================================================
# バリデーション
# =============================================================================

if [[ -z "${RUNPOD_API_KEY:-}" ]]; then
  log_error "RUNPOD_API_KEY 環境変数が設定されていません"
  echo "例: RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh --type qwen --image user/repo:tag" >&2
  exit 1
fi

if [[ -z "${ENDPOINT_TYPE}" ]]; then
  log_error "--type オプションが指定されていません（qwen）"
  usage
  exit 1
fi

if [[ "${ENDPOINT_TYPE}" != "qwen" ]]; then
  log_error "--type は qwen のみ指定できます（指定値: ${ENDPOINT_TYPE}）"
  exit 1
fi

if [[ "${DEPLOY_TARGET}" != "production" && "${DEPLOY_TARGET}" != "local" ]]; then
  log_error "--target は production または local を指定してください（指定値: ${DEPLOY_TARGET}）"
  exit 1
fi

if [[ "${ENDPOINT_TYPE}" == "qwen" && -z "${DOCKER_IMAGE}" ]]; then
  log_error "qwen タイプでは --image オプションが必須です"
  echo "例: --image your-username/techclip-qwen:latest" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  log_error "jq コマンドが見つかりません。Nix 環境に入っているか確認してください。"
  exit 1
fi

if ! command -v curl &>/dev/null; then
  log_error "curl コマンドが見つかりません。"
  exit 1
fi

# =============================================================================
# メイン処理
# =============================================================================

TEMPLATE_NAME=""
ENDPOINT_NAME=""
IMAGE_NAME=""
ENV_VARS=""

TEMPLATE_NAME="${QWEN_TEMPLATE_NAME}"
ENDPOINT_NAME="${QWEN_ENDPOINT_NAME}"
IMAGE_NAME="${DOCKER_IMAGE}"
ENV_VAR_NAME="RUNPOD_ENDPOINT_ID"

if [[ "${DEPLOY_TARGET}" == "local" ]]; then
  ENDPOINT_NAME="${ENDPOINT_NAME}-local"
  ENV_VAR_NAME="RUNPOD_LOCAL_ENDPOINT_ID"
fi

echo ""
echo "============================================"
echo "  RunPod サーバーレスプロビジョニング"
echo "============================================"
echo ""
echo "  種別:           ${ENDPOINT_TYPE}"
echo "  対象:           ${DEPLOY_TARGET}"
if [[ -n "${TEMPLATE_NAME}" ]]; then
  echo "  テンプレート:   ${TEMPLATE_NAME}"
fi
echo "  エンドポイント: ${ENDPOINT_NAME}"
if [[ -n "${IMAGE_NAME}" ]]; then
  echo "  イメージ:       ${IMAGE_NAME}"
fi
echo "  GPU:            ${GPU_TYPE}"
echo "  最大ワーカー:   ${MAX_WORKERS}"
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "  モード:         DRY-RUN（実際には作成しません）"
fi
echo ""

# API 接続の事前検証（dry-run 時はスキップ）
if [[ "${DRY_RUN}" != "true" ]]; then
  log_info "RunPod API 接続を確認中..."
  if ! graphql_request "{ myself { id } }" > /dev/null 2>&1; then
    log_error "RunPod API への接続に失敗しました。API キーが正しいか確認してください。"
    exit 1
  fi
  log_success "API 接続確認完了"
fi

# 既存エンドポイントの確認（dry-run 時はスキップ）
EXISTING_ENDPOINT_ID=""
if [[ "${DRY_RUN}" == "true" ]]; then
  log_info "既存エンドポイントの確認をスキップ（DRY-RUN）"
else
  log_info "既存エンドポイントを確認中..."
  EXISTING_ENDPOINT_ID=$(find_existing_endpoint "${ENDPOINT_NAME}" || echo "")
fi

if [[ -n "${EXISTING_ENDPOINT_ID}" ]]; then
  log_info "既存エンドポイントを更新します (ID: ${EXISTING_ENDPOINT_ID})"
else
  log_success "既存エンドポイントなし。新規作成します。"
fi

EXISTING_TEMPLATE_ID=""
if [[ "${DRY_RUN}" == "true" ]]; then
  log_info "既存テンプレートの確認をスキップ（DRY-RUN）"
else
  log_info "既存テンプレートを確認中..."
  EXISTING_TEMPLATE_ID=$(find_existing_template "${TEMPLATE_NAME}" || echo "")
fi

if [[ -n "${EXISTING_TEMPLATE_ID}" ]]; then
  log_skip "テンプレート '${TEMPLATE_NAME}' は既に存在します (ID: ${EXISTING_TEMPLATE_ID})"
  TEMPLATE_ID="${EXISTING_TEMPLATE_ID}"
else
  TEMPLATE_OUTPUT=$(create_template "${TEMPLATE_NAME}" "${IMAGE_NAME}" "${ENV_VARS}")
  TEMPLATE_ID=$(echo "$TEMPLATE_OUTPUT" | tail -1)

  if [[ -z "${TEMPLATE_ID}" ]]; then
    log_error "テンプレートの作成に失敗しました"
    exit 1
  fi
fi

ENDPOINT_OUTPUT=$(save_endpoint "${ENDPOINT_NAME}" "${TEMPLATE_ID}" "${GPU_TYPE}" "${MAX_WORKERS}" "${EXISTING_ENDPOINT_ID}")
ENDPOINT_ID=$(echo "$ENDPOINT_OUTPUT" | tail -1)

if [[ -z "${ENDPOINT_ID}" ]]; then
  log_error "エンドポイントの保存に失敗しました"
  exit 1
fi

echo ""
echo "============================================"
echo "  プロビジョニング完了"
echo "============================================"
echo ""
if [[ -n "${TEMPLATE_ID}" ]]; then
  echo "  テンプレートID:   ${TEMPLATE_ID}"
fi
echo "  エンドポイントID: ${ENDPOINT_ID}"
echo ""
echo "  環境変数に設定してください:"
echo "    ${ENV_VAR_NAME}=${ENDPOINT_ID}"
echo ""
echo "  ローカル開発 (apps/api/.dev.vars):"
echo "    ${ENV_VAR_NAME}=${ENDPOINT_ID}"
echo ""
echo "  本番環境 (Wrangler シークレット):"
echo "    wrangler secret put ${ENV_VAR_NAME}"
echo ""
