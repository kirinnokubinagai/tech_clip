# RunPod サーバーレスデプロイ手順

TechClipのAI要約・翻訳機能で使用するRunPodサーバーレスエンドポイントのデプロイ手順。

## エンドポイント構成

| エンドポイント | 用途 | Docker イメージ |
|---------------|------|----------------|
| Qwen2.5 (要約・翻訳) | 技術記事のAI要約と翻訳 | カスタムビルド |
| Faster Whisper (文字起こし) | 動画コンテンツの音声文字起こし | `runpod/worker-faster_whisper:latest` |

## 前提条件

- Docker（ビルド・プッシュ用、Qwen のみ）
- Docker Hub アカウント（またはその他のコンテナレジストリ）
- RunPod アカウント（https://runpod.io）
- RunPod API キー
- Nix 開発環境（`curl` と `jq` が必要）

## クイックスタート（自動プロビジョニング）

### Qwen エンドポイント（要約・翻訳）

```bash
# 1. Docker イメージをビルド・プッシュ
export DOCKER_IMAGE=your-dockerhub-username/techclip-runpod:latest
bash scripts/deploy-runpod.sh

# 2. エンドポイントを自動作成
RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh \
  --type qwen \
  --image your-dockerhub-username/techclip-runpod:latest
```

### Whisper エンドポイント（文字起こし）

```bash
# RunPod 公式の Faster Whisper イメージを使用するため、ビルド不要
RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh --type whisper
```

### プロビジョニングオプション

```bash
RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh \
  --type qwen|whisper \   # エンドポイント種別（必須）
  --image <image>     \   # Docker イメージ（qwen の場合は必須）
  --gpu AMPERE_24     \   # GPU タイプ（デフォルト: AMPERE_24 = RTX 4090）
  --workers 3         \   # 最大ワーカー数（デフォルト: 3）
  --dry-run               # 実際には作成せず内容を表示
```

スクリプトは冪等性があり、同名のエンドポイントが既に存在する場合はスキップする。

## 手動デプロイ手順

自動プロビジョニングを使わない場合の手順。

### 1. Docker イメージのビルドとプッシュ（Qwen のみ）

`scripts/deploy-runpod.sh` を使用する。

```bash
export DOCKER_IMAGE=your-dockerhub-username/techclip-runpod:latest
bash scripts/deploy-runpod.sh
```

または手動でビルド・プッシュする場合:

```bash
cd infra/runpod

docker build -t your-dockerhub-username/techclip-runpod:latest .
docker push your-dockerhub-username/techclip-runpod:latest
```

### 2. RunPod テンプレートの作成

1. [RunPod コンソール](https://www.runpod.io/console/serverless) にログイン
2. **Serverless** メニューを開く
3. **New Template** をクリック
4. 以下の設定を入力する:

**Qwen テンプレート:**

| 項目 | 値 |
|------|-----|
| Template Name | `techclip-qwen2.5-9b` |
| Container Image | `your-dockerhub-username/techclip-runpod:latest` |
| Container Disk | `20 GB` 以上 |

**Whisper テンプレート:**

| 項目 | 値 |
|------|-----|
| Template Name | `techclip-faster-whisper` |
| Container Image | `runpod/worker-faster_whisper:latest` |
| Container Disk | `20 GB` 以上 |

### 3. サーバーレスエンドポイントの作成

1. **New Endpoint** をクリック
2. 作成したテンプレートを選択
3. 以下の設定を入力する:

| 項目 | 推奨値 |
|------|--------|
| Endpoint Name | `techclip-qwen2.5` / `techclip-whisper` |
| GPU | `RTX 4090` (AMPERE_24) 推奨 |
| Min Provisioned Workers | `0`（コスト最適化） |
| Max Workers | `3` |
| Idle Timeout | `5` 秒 |
| Execution Timeout | `300` 秒 |

4. **Deploy** をクリック
5. 作成されたエンドポイントIDをコピーする

### 4. 環境変数の設定

**ローカル開発 (`apps/api/.dev.vars`):**

```env
RUNPOD_API_KEY=your_runpod_api_key_here
RUNPOD_ENDPOINT_ID=your_qwen_endpoint_id_here
RUNPOD_WHISPER_ENDPOINT_ID=your_whisper_endpoint_id_here
```

**本番環境（Wrangler シークレット）:**

```bash
wrangler secret put RUNPOD_API_KEY --env production
wrangler secret put RUNPOD_ENDPOINT_ID --env production
wrangler secret put RUNPOD_WHISPER_ENDPOINT_ID --env production
```

### 5. RunPod API キーの取得

1. [RunPod アカウント設定](https://www.runpod.io/console/user/settings) を開く
2. **API Keys** セクションで **+ API Key** をクリック
3. キー名を入力して生成する（例: `techclip-production`）
4. 生成されたキーをコピーして環境変数に設定する

## 完全デプロイワークフロー

両方のエンドポイントを一括でセットアップする手順:

```bash
# 1. Nix 開発環境に入る
nix develop

# 2. Qwen の Docker イメージをビルド・プッシュ
export DOCKER_IMAGE=your-username/techclip-runpod:latest
bash scripts/deploy-runpod.sh

# 3. Qwen エンドポイントをプロビジョニング
RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh \
  --type qwen \
  --image your-username/techclip-runpod:latest

# 4. Whisper エンドポイントをプロビジョニング
RUNPOD_API_KEY=xxx bash scripts/provision-runpod.sh --type whisper

# 5. 表示されたエンドポイントIDを .dev.vars に設定
```

## API リクエスト形式

### Qwen: 要約用（prompt 形式）

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

### Qwen: 翻訳用（messages 形式）

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

### Whisper: 文字起こし

```json
{
  "input": {
    "audio": "https://example.com/audio.mp3",
    "model": "large-v3",
    "language": "en"
  }
}
```

## GPU 要件

| モデル | 必要 VRAM | 推奨 GPU |
|--------|----------|---------|
| Qwen2.5-7B-Instruct | 16GB 以上 | RTX 4090 (24GB) |
| Faster Whisper large-v3 | 8GB 以上 | RTX 4090 (24GB) |

## トラブルシューティング

### OOM エラーが発生する場合

`handler.py` の `gpu_memory_utilization` を下げる（例: `0.85`）か、より大きな VRAM の GPU を使用する。

### コンテナ起動が遅い場合

初回起動時はモデルのロードに1〜2分かかる。RunPod の Flashboot オプションを有効にすることで改善できる。

### タイムアウトが発生する場合

エンドポイントの **Execution Timeout** を増やす（推奨: 300秒）。

### プロビジョニングスクリプトがエラーになる場合

- `RUNPOD_API_KEY` が正しく設定されているか確認する
- `jq` と `curl` がインストールされているか確認する（`nix develop` で自動的に入る）
- `--dry-run` オプションでリクエスト内容を確認する
