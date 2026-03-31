#!/usr/bin/env bash
# RunPod サーバーレス用 Docker イメージをビルドしてプッシュするスクリプト
#
# 使用方法:
#   export DOCKER_IMAGE=your-username/techclip-runpod:latest
#   bash scripts/deploy-runpod.sh
#
# 環境変数:
#   DOCKER_IMAGE  - プッシュ先のDockerイメージ名（必須）
#   PLATFORM      - ビルドプラットフォーム（デフォルト: linux/amd64）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infra/runpod"

# 必須環境変数チェック
if [[ -z "${DOCKER_IMAGE:-}" ]]; then
  echo "エラー: DOCKER_IMAGE 環境変数が設定されていません"
  echo "例: export DOCKER_IMAGE=your-username/techclip-runpod:latest"
  exit 1
fi

PLATFORM="${PLATFORM:-linux/amd64}"

echo "==> RunPod サーバーレスデプロイを開始します"
echo "    イメージ: ${DOCKER_IMAGE}"
echo "    プラットフォーム: ${PLATFORM}"
echo "    ビルドコンテキスト: ${INFRA_DIR}"
echo ""

# Dockerfileの存在確認
if [[ ! -f "${INFRA_DIR}/Dockerfile" ]]; then
  echo "エラー: Dockerfile が見つかりません: ${INFRA_DIR}/Dockerfile"
  exit 1
fi

# Dockerビルド
echo "==> Docker イメージをビルド中..."
docker build \
  --platform "${PLATFORM}" \
  --tag "${DOCKER_IMAGE}" \
  "${INFRA_DIR}"

echo ""
echo "==> Docker イメージをプッシュ中..."
docker push "${DOCKER_IMAGE}"

echo ""
echo "==> デプロイ完了"
echo ""
echo "次のステップ:"
echo "  自動プロビジョニング（推奨）:"
echo "    RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh --type qwen --image ${DOCKER_IMAGE}"
echo ""
echo "  または手動で RunPod コンソールからエンドポイントを作成:"
echo "    1. https://www.runpod.io/console/serverless でテンプレートを作成"
echo "       - Container Image: ${DOCKER_IMAGE}"
echo "    2. サーバーレスエンドポイントを作成してエンドポイントIDを取得"
echo "    3. 環境変数を設定:"
echo "       - RUNPOD_API_KEY=<your-runpod-api-key>"
echo "       - RUNPOD_ENDPOINT_ID=<your-endpoint-id>"
echo ""
echo "詳細は infra/runpod/README.md を参照してください。"
