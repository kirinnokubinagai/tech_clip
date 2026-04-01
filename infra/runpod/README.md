# RunPod サーバーレスデプロイ手順

TechClipのAI要約・翻訳機能で使用するQwen3.5 9BモデルをRunPodサーバーレスにデプロイする手順。

## 前提条件

- Docker（ビルド・プッシュ用）
- Docker Hubアカウント（またはその他のコンテナレジストリ）
- RunPodアカウント（https://runpod.io）
- RunPod APIキー

## デプロイ手順

### 1. Docker イメージのビルドとプッシュ

`scripts/deploy-runpod.sh` を使用する。

```bash
# 環境変数を設定
export DOCKER_IMAGE=your-dockerhub-username/techclip-qwen:latest

# ビルドとプッシュ
bash scripts/deploy-runpod.sh
```

または手動でビルド・プッシュする場合:

```bash
cd infra/runpod

# ビルド（初回はモデルダウンロードで時間がかかる）
docker build -t your-dockerhub-username/techclip-qwen:latest .

# プッシュ
docker push your-dockerhub-username/techclip-qwen:latest
```

### 2. RunPod テンプレートと endpoint の自動作成

`scripts/provision-runpod.sh` を使うと、Qwen 用の template / endpoint をコードから作成または更新できる。

```bash
RUNPOD_API_KEY=your_runpod_api_key_here \
bash scripts/provision-runpod.sh \
  --type qwen \
  --target production \
  --image your-dockerhub-username/techclip-qwen:latest
```

GitHub Actions から実行する場合は `Provision RunPod` workflow を `workflow_dispatch` で起動する。
`--target local` で作成した endpoint は、開発環境では `RUNPOD_LOCAL_ENDPOINT_ID` として使う。

### 3. 手動で作成する場合

1. [RunPod コンソール](https://www.runpod.io/console/serverless) にログイン
2. **Serverless** メニューを開く
3. **New Template** をクリック
4. 以下の設定を入力する:

| 項目 | 値 |
|------|-----|
| Template Name | `techclip-qwen3.5-9b` |
| Container Image | `your-dockerhub-username/techclip-qwen:latest` |
| Container Disk | `20 GB` 以上 |
| GPU | `RTX 4090` または `A100` 推奨（VRAM 24GB以上） |

### 4. サーバーレスエンドポイントの作成

1. **New Endpoint** をクリック
2. 作成したテンプレートを選択
3. 以下の設定を入力する:

| 項目 | 推奨値 |
|------|--------|
| Endpoint Name | `techclip-qwen3.5` |
| Min Provisioned Workers | `0`（コスト最適化） |
| Max Workers | `3` |
| Idle Timeout | `5` 秒 |
| Execution Timeout | `300` 秒 |

4. **Deploy** をクリック
5. 作成されたエンドポイントIDをコピーする（例: `abc123def456`）

### 5. 環境変数の設定

Cloudflare Workers の環境変数（`apps/api/.dev.vars` またはWranglerシークレット）に設定する。

**ローカル開発 (`apps/api/.dev.vars`):**

```env
RUNPOD_API_KEY=your_runpod_api_key_here
RUNPOD_ENDPOINT_ID=your_endpoint_id_here
RUNPOD_LOCAL_ENDPOINT_ID=your_local_endpoint_id_here
```

**本番環境（Wranglerシークレット）:**

```bash
# APIキーをシークレットとして登録
wrangler secret put RUNPOD_API_KEY --env production

# エンドポイントIDをシークレットとして登録
wrangler secret put RUNPOD_ENDPOINT_ID --env production
```

`ENVIRONMENT=development` かつ `RUNPOD_LOCAL_ENDPOINT_ID` が設定されている場合、API は local endpoint を優先して使う。

### 6. RunPod APIキーの取得

1. [RunPod アカウント設定](https://www.runpod.io/console/user/settings) を開く
2. **API Keys** セクションで **+ API Key** をクリック
3. キー名を入力して生成する（例: `techclip-production`）
4. 生成されたキーをコピーして環境変数に設定する

## API リクエスト形式

ハンドラーは2種類のリクエスト形式に対応している。

### 要約用（prompt形式）

```json
{
  "input": {
    "prompt": "Summarize the following article...",
    "max_tokens": 1024,
    "temperature": 0.3
  }
}
```

レスポンス:

```json
{
  "output": {
    "text": "生成されたテキスト"
  }
}
```

### 翻訳用（messages形式）

```json
{
  "input": {
    "messages": [
      {
        "role": "user",
        "content": "Translate the following text..."
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
          "content": "翻訳されたテキスト"
        }
      }
    ]
  }
}
```

## GPU要件

| モデル | 必要VRAM | 推奨GPU |
|--------|---------|---------|
| Qwen3.5-9B | 18GB以上 | RTX 4090 (24GB) |

## トラブルシューティング

### OOMエラーが発生する場合

`handler.py` の `gpu_memory_utilization` を下げる（例: `0.85`）か、より大きなVRAMのGPUを使用する。

### コンテナ起動が遅い場合

初回起動時はモデルのロードに1〜2分かかる。RunPodのFlashbootオプションを有効にすることで改善できる。

### タイムアウトが発生する場合

エンドポイントの **Execution Timeout** を増やす（推奨: 300秒）。
