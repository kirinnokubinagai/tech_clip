#!/usr/bin/env bash
set -euo pipefail

# Gemini API 画像編集 (curl版)
# 使い方:
#   ./edit_image.sh input.png "Change the sky to sunset" --model gemini-2.0-flash-exp
#   ./edit_image.sh photo.jpg "Add a rainbow" --model gemini-2.0-flash-exp --output edited.png

API_BASE="https://generativelanguage.googleapis.com/v1beta"

MODEL="${GEMINI_IMAGE_MODEL:-}"
OUTPUT=""
INPUT=""
PROMPT=""

usage() {
  cat <<EOF
Gemini API 画像編集 (curl版)

使い方:
  $(basename "$0") INPUT_FILE "編集プロンプト" --model MODEL [--output FILE]

オプション:
  --model, -m    使用するモデル名
  --output, -o   出力ファイル名 (デフォルト: {入力名}_edited.png)
  --help, -h     このヘルプを表示
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model|-m)   MODEL="$2"; shift 2 ;;
    --output|-o)  OUTPUT="$2"; shift 2 ;;
    --help|-h)    usage; exit 0 ;;
    -*)           echo "エラー: 不明なオプション: $1"; exit 1 ;;
    *)
      if [[ -z "$INPUT" ]]; then
        INPUT="$1"
      elif [[ -z "$PROMPT" ]]; then
        PROMPT="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "エラー: GEMINI_API_KEY 環境変数が設定されていません"
  exit 1
fi

if [[ -z "$INPUT" || -z "$PROMPT" ]]; then
  echo "エラー: 入力ファイルとプロンプトを指定してください"
  usage
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "エラー: ファイルが見つかりません: $INPUT"
  exit 1
fi

if [[ -z "$MODEL" ]]; then
  echo "エラー: モデルが指定されていません"
  exit 1
fi

if [[ -z "$OUTPUT" ]]; then
  BASE="${INPUT%.*}"
  OUTPUT="${BASE}_edited.png"
fi

MIME_TYPE="image/png"
case "$INPUT" in
  *.jpg|*.jpeg) MIME_TYPE="image/jpeg" ;;
  *.webp)       MIME_TYPE="image/webp" ;;
esac

IMAGE_B64=$(base64 < "$INPUT")

echo "入力: $INPUT"
echo "編集内容: $PROMPT"
echo "モデル: $MODEL"
echo "編集中..."

RESPONSE=$(curl -s "${API_BASE}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg prompt "$PROMPT" \
    --arg mime "$MIME_TYPE" \
    --arg data "$IMAGE_B64" \
    '{
      contents: [{
        parts: [
          {inlineData: {mimeType: $mime, data: $data}},
          {text: $prompt}
        ]
      }],
      generationConfig: {responseModalities: ["IMAGE"]}
    }')")

ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
if [[ -n "$ERROR" ]]; then
  echo "エラー: $ERROR"
  exit 1
fi

IMAGE_DATA=$(echo "$RESPONSE" | jq -r '
  .candidates[0].content.parts[]
  | select(.inlineData)
  | .inlineData.data // empty
')

if [[ -z "$IMAGE_DATA" ]]; then
  echo "エラー: 画像データが含まれていません"
  exit 1
fi

echo "$IMAGE_DATA" | base64 -d > "$OUTPUT"

echo ""
echo "編集完了:"
echo "  ファイル: $OUTPUT"
echo "  サイズ: $(wc -c < "$OUTPUT" | tr -d ' ') bytes"
