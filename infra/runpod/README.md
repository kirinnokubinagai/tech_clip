# RunPod サーバーレスデプロイ手順

TechClip の AI 要約・翻訳機能で使用する `raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4` モデルを RunPod Serverless にデプロイする手順。

vLLM でモデルをロードし、0xSero/turboquant で KV キャッシュを圧縮することで、RTX 4080 / A4000（16GB VRAM）での動作を実現する。

## 前提条件

- Docker（ビルド・プッシュ用）
- Docker Hub アカウント（またはその他のコンテナレジストリ）
- RunPod アカウント（https://runpod.io）
- RunPod API キー
- HuggingFace アカウントと API トークン（モデルダウンロード用）

## モデル情報

| 項目 | 値 |
|------|-----|
| モデル ID | `raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4` |
| 量子化方式 | GPTQ Int4 |
| 推定 VRAM（モデル重み） | ~13-15 GB |
| 推奨残余 VRAM（KV キャッシュ等） | ~1-3 GB |
| 推奨 GPU | RTX 4080 / A4000（16GB VRAM） |

## TurboQuant について

0xSero/turboquant（ICLR 2026、arXiv:2504.19874）は vLLM の attention backend に monkey-patch を挿入し、KV キャッシュを圧縮する。

- key: 3-bit（ほぼ無損失、cos_sim=1.000）
- value: 2-bit（cos_sim=0.94）
- full-attention 層のみ圧縮（linear-attention/Mamba 層は対象外）
- 4.4x の KV キャッシュ圧縮（head_dim=256 の dense モデル）

インストールは GitHub リポジトリを直接指定する:

```bash
pip install git+https://github.com/0xSero/turboquant.git@7ac9b8d165a3f7d5e6df33b0450bc1f88ec0d4d5
```

vLLM 統合は `turboquant.vllm_attn_backend.install_turboquant_hooks` を使用する:

```python
from turboquant.vllm_attn_backend import install_turboquant_hooks, MODE_ACTIVE

install_turboquant_hooks(
    worker.model_runner,
    key_bits=3,
    value_bits=2,
    buffer_size=128,
    mode=MODE_ACTIVE,
)
```

## モデルの事前ダウンロード

`TRANSFORMERS_OFFLINE=1` のため、コンテナ起動前にモデルを事前ダウンロードしておく必要がある。

```bash
# HuggingFace Token が必要な場合は環境変数で設定
export HF_TOKEN=your_hf_token_here

HF_HOME=/runpod-volume/hf-cache python3 -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4',
    token='${HF_TOKEN}',
)
"
```

または RunPod コンソールの **Cached Models** 機能を使って `/runpod-volume/hf-cache` にダウンロードする。

## デプロイ手順

### 1. Docker イメージのビルドとプッシュ

```bash
# 環境変数を設定
export DOCKER_IMAGE=your-dockerhub-username/techclip-gemma4:latest

# ビルドとプッシュ
bash scripts/deploy-runpod.sh
```

または手動でビルド・プッシュする場合（リポジトリルートから実行）:

```bash
# ビルド（リポジトリルートから実行）
docker build -t your-dockerhub-username/techclip-gemma4:latest infra/runpod/

# プッシュ
docker push your-dockerhub-username/techclip-gemma4:latest
```

### 2. RunPod テンプレートと endpoint の自動作成

`scripts/provision-runpod.sh` を使うと、template / endpoint をコードから作成または更新できる。

```bash
# APIキーはシェル変数ではなく .env ファイル経由で読み込むことを推奨（シェル履歴にキーが残るため）
# 例: echo 'RUNPOD_API_KEY=your_runpod_api_key_here' >> .env && source .env
bash scripts/provision-runpod.sh \
  --type gemma \
  --target production \
  --image your-dockerhub-username/techclip-gemma4:latest
```

`--target local` で作成した endpoint は、開発環境では `RUNPOD_LOCAL_ENDPOINT_ID` として使う。

### 3. 手動で作成する場合

1. [RunPod コンソール](https://www.runpod.io/console/serverless) にログイン
2. **Serverless** メニューを開く
3. **New Template** をクリック
4. 以下の設定を入力する:

| 項目 | 値 |
|------|-----|
| Template Name | `techclip-gemma4-26b-gptq-int4` |
| Container Image | `your-dockerhub-username/techclip-gemma4:latest` |
| Container Disk | `20 GB` |
| GPU | RTX 4080 / A4000（16GB VRAM） |
| FlashBoot | `ON` |
| Cached Models | `ON` |

### 4. サーバーレスエンドポイントの作成

1. **New Endpoint** をクリック
2. 作成したテンプレートを選択
3. 以下の設定を入力する:

| 項目 | 推奨値 |
|------|--------|
| Endpoint Name | `techclip-gemma4` |
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

> **注意**: `apps/api/.dev.vars` は `.gitignore` に含まれていることを必ず確認すること。API キーなどの機密情報をリポジトリにコミットしないよう注意すること。

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
    "max_new_tokens": 512,
    "temperature": 0.7,
    "top_p": 0.9
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

Docker image はモデルを build 時に含めない。RunPod の `cached models` と Hugging Face cache を使って起動時にモデルをロードする（コールドスタート対策）。

モデル ID は `MODEL_ID` 環境変数で上書き可能:

```env
MODEL_ID=raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4
```

### デフォルト環境変数

```env
MODEL_ID=raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4
HF_HOME=/runpod-volume/hf-cache
TRANSFORMERS_OFFLINE=1
```

> **重要**: `TRANSFORMERS_OFFLINE=1` のため、コンテナ起動前にモデルを `/runpod-volume/hf-cache` へ事前ダウンロードしておくこと。

## トラブルシューティング

### OOM エラーが発生する場合

16GB VRAM GPU（RTX 4080 / A4000）を使用していること、および他のプロセスが VRAM を占有していないことを確認する。改善しない場合は 24GB 以上の GPU に変更する。

### TurboQuant フックのインストールが失敗する場合

ハンドラーは TurboQuant フックのインストール失敗を警告として記録し、圧縮なしで推論を続行する。
ログに `TurboQuant フックのインストールに失敗しました` と出ている場合は turboquant パッケージのインストール状況と vLLM バージョンの互換性を確認する。

### コールドスタートが遅い場合

`FlashBoot` と `Cached Models` を有効にする。`HF_HOME=/runpod-volume/hf-cache` を設定してモデルキャッシュを永続ボリュームに保存することで、2回目以降の起動を大幅に短縮できる。

### タイムアウトが発生する場合

エンドポイントの **Execution Timeout** を増やす（推奨: 300 秒）。

## バージョン管理

以下の組み合わせで構成:

| コンポーネント | バージョン | 備考 |
|----------------|------------|------|
| ベースイメージ | `vllm/vllm-openai:v0.9.0` | vLLM 公式イメージ（PyTorch + CUDA 同梱） |
| Python | `3.12` | ベースイメージに同梱 |
| vLLM | `0.9.0` | GPTQ サポート、TurboQuant vLLM 統合対応 |
| turboquant | `@7ac9b8d165a3f7d5e6df33b0450bc1f88ec0d4d5`（0xSero/turboquant） | vLLM integration API 対応・`pip audit` の対象外のため定期的に upstream のコミット履歴を手動確認すること |
| RunPod SDK | `1.7.4` | サーバーレスランタイム |

バージョンを変更する場合は `requirements.txt` と `Dockerfile` を更新し、動作確認後にこのテーブルを更新すること。
