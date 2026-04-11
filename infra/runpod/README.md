# RunPod サーバーレスデプロイ手順

TechClip の AI 要約・翻訳機能で使用する Gemma 3 12B IT モデルを RunPod Serverless にデプロイする手順。
デフォルトは Google 公式 `google/gemma-3-12b-it` を使用する。量子化モデルを利用する場合は `VLLM_QUANTIZATION` 環境変数と信頼できる組織（例: neuralmagic / RedHatAI / google）の AWQ モデルを別途指定する。量子化により推論速度が向上し、16GB GPU でも `MAX_MODEL_LEN=8192` を実現できる。

## 前提条件

- Docker（ビルド・プッシュ用）
- Docker Hub アカウント（またはその他のコンテナレジストリ）
- RunPod アカウント（https://runpod.io）
- RunPod API キー

## デプロイ手順

### 1. Docker イメージのビルドとプッシュ

`scripts/deploy-runpod.sh` を使用する。

```bash
# 環境変数を設定
export DOCKER_IMAGE=your-dockerhub-username/techclip-gemma:latest

# ビルドとプッシュ
bash scripts/deploy-runpod.sh
```

または手動でビルド・プッシュする場合:

```bash
cd infra/runpod

# ビルド
docker build -t your-dockerhub-username/techclip-gemma:latest .

# プッシュ
docker push your-dockerhub-username/techclip-gemma:latest
```

### 2. RunPod テンプレートと endpoint の自動作成

`scripts/provision-runpod.sh` を使うと、template / endpoint をコードから作成または更新できる。

```bash
# APIキーはシェル変数ではなく .env ファイル経由で読み込むことを推奨（シェル履歴にキーが残るため）
# 例: echo 'RUNPOD_API_KEY=your_runpod_api_key_here' >> .env && source .env
bash scripts/provision-runpod.sh \
  --type gemma \
  --target production \
  --image your-dockerhub-username/techclip-gemma:latest
```

`--target local` で作成した endpoint は、開発環境では `RUNPOD_LOCAL_ENDPOINT_ID` として使う。

### 3. 手動で作成する場合

1. [RunPod コンソール](https://www.runpod.io/console/serverless) にログイン
2. **Serverless** メニューを開く
3. **New Template** をクリック
4. 以下の設定を入力する:

| 項目 | 値 |
|------|-----|
| Template Name | `techclip-gemma3-12b-awq` |
| Container Image | `your-dockerhub-username/techclip-gemma:latest` |
| Container Disk | `20 GB` |
| GPU | 16GB VRAM 以上の GPU（例: A4000 16GB、RTX 4000 Ada 20GB） |
| FlashBoot | `ON` |
| Cached Models | `ON` |

### 4. サーバーレスエンドポイントの作成

1. **New Endpoint** をクリック
2. 作成したテンプレートを選択
3. 以下の設定を入力する:

| 項目 | 推奨値 |
|------|--------|
| Endpoint Name | `techclip-gemma3` |
| Min Provisioned Workers | `0`（コスト最適化） |
| Max Workers | `1` から開始 |
| Idle Timeout | `120` 秒 |
| Execution Timeout | `300` 秒 |

4. **Deploy** をクリック
5. 作成されたエンドポイント ID をコピーする（例: `abc123def456`）

`Idle Timeout` は、最後のリクエストを処理し終えた worker を何秒間そのまま残すかの設定。
`Min Provisioned Workers = 0` でも、この時間内に次のリクエストが来れば warm な worker が再利用される。
起動速度を優先するなら `60` から `120` 秒が実用的。

### 5. 環境変数の設定

Cloudflare Workers の環境変数（`apps/api/.dev.vars` または Wrangler シークレット）に設定する。

**ローカル開発 (`apps/api/.dev.vars`):**

```env
RUNPOD_API_KEY=your_runpod_api_key_here
RUNPOD_ENDPOINT_ID=your_endpoint_id_here
RUNPOD_LOCAL_ENDPOINT_ID=your_local_endpoint_id_here
```

**本番環境（Wrangler シークレット）:**

```bash
# API キーをシークレットとして登録
wrangler secret put RUNPOD_API_KEY --env production

# エンドポイント ID をシークレットとして登録
wrangler secret put RUNPOD_ENDPOINT_ID --env production
```

`ENVIRONMENT=development` かつ `RUNPOD_LOCAL_ENDPOINT_ID` が設定されている場合、API は local endpoint を優先して使う。

### 6. RunPod API キーの取得

1. [RunPod アカウント設定](https://www.runpod.io/console/user/settings) を開く
2. **API Keys** セクションで **+ API Key** をクリック
3. キー名を入力して生成する（例: `techclip-production`）
4. 生成されたキーをコピーして環境変数に設定する

## API リクエスト形式

ハンドラーは `messages` 形式のみをサポートする。

```json
{
  "input": {
    "messages": [
      {
        "role": "user",
        "content": "次の記事を要約してください: ..."
      }
    ],
    "max_tokens": 4096,
    "temperature": 0.3
  }
}
```

レスポンス:

```json
{
  "output": {
    "choices": [
      {
        "message": {
          "role": "assistant",
          "content": "生成されたテキスト"
        }
      }
    ]
  }
}
```

## モデル設定

この Docker image はモデルを build 時に含めない。RunPod の `cached models` と Hugging Face cache を使って起動時にモデルを解決する。

モデル名は以下の優先順で解決する:
1. `GEMMA_MODEL_NAME` 環境変数
2. `MODEL_PATH` 環境変数
3. `MODEL_NAME` 環境変数
4. デフォルト（`google/gemma-3-12b-it`）

**注意**: `MODEL_NAME` は外部から任意のモデルに上書き可能なため、許可モデル一覧は管理ドキュメントで管理し変更はレビュー必須とする。

### デフォルト環境変数

```env
MODEL_NAME=google/gemma-3-12b-it
VLLM_QUANTIZATION=
VLLM_DTYPE=auto
MAX_MODEL_LEN=8192
MAX_NUM_SEQS=4
GPU_MEMORY_UTILIZATION=0.90
TENSOR_PARALLEL_SIZE=1
```

### 量子化設定（VLLM_QUANTIZATION）

`VLLM_QUANTIZATION` 環境変数で量子化方式を制御する:

| 値 | 説明 |
|----|------|
| `awq` | AWQ 量子化（推奨）。Marlin カーネルで高速推論 |
| `gptq_marlin` | GPTQ + Marlin カーネル |
| `fp8` | FP8 量子化（H100 / H200 等の対応 GPU が必要） |
| 空文字 / 未設定 | 量子化なし（後方互換）。`bfloat16` で動作 |

AWQ 量子化を使う場合は `VLLM_DTYPE=auto` を推奨する（vLLM が自動でカーネルを選択する）。

### 非量子化で動かす場合

```env
MODEL_NAME=google/gemma-3-12b-it
VLLM_QUANTIZATION=
VLLM_DTYPE=bfloat16
MAX_MODEL_LEN=4096
MAX_NUM_SEQS=2
GPU_MEMORY_UTILIZATION=0.85
```

## 量子化のメリット

| 指標 | 非量子化（bfloat16） | AWQ 量子化 |
|------|---------------------|------------|
| モデルサイズ | 約 24 GB | 約 7 GB |
| 推論速度 | ベースライン | 約 2-3x 高速（GPU 環境・ワークロードにより異なる） |
| 最大コンテキスト長（16GB GPU） | 4096 | 8192 |
| 同時シーケンス数（16GB GPU） | 2 | 4 |

量子化により同じ GPU メモリでより多くのリクエストを並列処理できる。

## トラブルシューティング

### OOM エラーが発生する場合

`GPU_MEMORY_UTILIZATION`、`MAX_MODEL_LEN`、`MAX_NUM_SEQS` を下げる。改善しない場合は 24GB GPU に上げる。

### コールドスタートが遅い場合

`FlashBoot` と `Cached Models` を有効にする。初回ロード後は cold start をかなり短縮できる。AWQ 量子化はモデルサイズが小さいため、非量子化より cold start も短縮される。

### タイムアウトが発生する場合

エンドポイントの **Execution Timeout** を増やす（推奨: 300 秒）。

### 量子化モデルで精度が落ちる場合

`VLLM_QUANTIZATION` を空にして非量子化モードに切り替える（後方互換のため動作する）。
