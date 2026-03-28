#!/usr/bin/env bash
set -euo pipefail

# Gemini API 画像生成 (curl版)
# 使い方:
#   ./generate_image.sh "A sunset" --model gemini-2.0-flash-exp
#   ./generate_image.sh "A cat" --model gemini-2.0-flash-exp --output-dir ./out
#   ./generate_image.sh --list-models

API_BASE="https://generativelanguage.googleapis.com/v1beta"

# デフォルト値
MODEL="${GEMINI_IMAGE_MODEL:-}"
OUTPUT_DIR="output"
PROMPT=""
LIST_MODELS=false

usage() {
  cat <<EOF
Gemini API 画像生成 (curl版)

使い方:
  $(basename "$0") "プロンプト" --model MODEL [--output-dir DIR]
  $(basename "$0") --list-models

オプション:
  --model, -m        使用するモデル名
  --output-dir, -o   出力先ディレクトリ (デフォルト: output)
  --list-models      利用可能な画像モデル一覧
  --help, -h         このヘルプを表示
EOF
}

# 引数パース
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model|-m)       MODEL="$2"; shift 2 ;;
    --output-dir|-o)  OUTPUT_DIR="$2"; shift 2 ;;
    --list-models)    LIST_MODELS=true; shift ;;
    --help|-h)        usage; exit 0 ;;
    -*)               echo "エラー: 不明なオプション: $1"; exit 1 ;;
    *)                PROMPT="$1"; shift ;;
  esac
done

# APIキー確認
if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "エラー: GEMINI_API_KEY 環境変数が設定されていません"
  exit 1
fi

# モデル一覧
if $LIST_MODELS; then
  echo "=== 画像生成モデル一覧 ==="
  echo ""
  curl -s "${API_BASE}/models?key=${GEMINI_API_KEY}" \
    | jq -r '.models[] | select(.name | test("image"; "i")) | .name | sub("^models/"; "")' \
    | while read -r name; do echo "  $name"; done
  exit 0
fi

# バリデーション
if [[ -z "$PROMPT" ]]; then
  echo "エラー: プロンプトを指定してください"
  usage
  exit 1
fi

if [[ -z "$MODEL" ]]; then
  echo "エラー: モデルが指定されていません"
  echo "  --model で指定するか、GEMINI_IMAGE_MODEL 環境変数を設定してください"
  echo "  利用可能モデル: --list-models で確認"
  exit 1
fi

# 出力ディレクトリ作成
mkdir -p "$OUTPUT_DIR"

echo "モデル: $MODEL"
echo "プロンプト: $PROMPT"
echo "生成中..."
echo ""

# API呼び出し
RESPONSE=$(curl -s "${API_BASE}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg prompt "$PROMPT" '{
    contents: [{parts: [{text: $prompt}]}],
    generationConfig: {responseModalities: ["IMAGE"]}
  }')")

# エラーチェック
ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
if [[ -n "$ERROR" ]]; then
  echo "エラー: $ERROR"
  exit 1
fi

# base64画像データ抽出
IMAGE_DATA=$(echo "$RESPONSE" | jq -r '
  .candidates[0].content.parts[]
  | select(.inlineData)
  | .inlineData.data // empty
')

if [[ -z "$IMAGE_DATA" ]]; then
  echo "エラー: 画像データが含まれていません"
  echo "レスポンス:"
  echo "$RESPONSE" | jq '.candidates[0].content.parts[0]' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

# 保存
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILEPATH="${OUTPUT_DIR}/gemini_${TIMESTAMP}.png"

echo "$IMAGE_DATA" | base64 -d > "$FILEPATH"

echo "画像を保存しました:"
echo "  ファイル: $FILEPATH"
echo "  サイズ: $(wc -c < "$FILEPATH" | tr -d ' ') bytes"
