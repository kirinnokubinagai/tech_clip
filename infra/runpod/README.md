# RunPod サーバーレスデプロイ手順

TechClip の AI 要約・翻訳機能で使用する `Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound` モデルを RunPod Serverless にデプロイする手順。

HuggingFace Transformers で直接ロードし、TurboQuant（back2matching/turboquant）で KV キャッシュを圧縮することで、RTX 4080 / A4000（16GB VRAM）での動作を実現する。

## 前提条件

- Docker（ビルド・プッシュ用）
- Docker Hub アカウント（またはその他のコンテナレジストリ）
- RunPod アカウント（https://runpod.io）
- RunPod API キー

## モデル情報

| 項目 | 値 |
|------|-----|
| モデル ID | `Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound` |
| 量子化方式 | Intel AutoRound int4-mixed |
| 推定 VRAM（モデル重み） | ~14 GB |
| 推奨残余 VRAM（KV キャッシュ等） | ~2 GB |
| 推奨 GPU | RTX 4080 / A4000（16GB VRAM） |

## TurboQuant について

Gemma 4 26B-A4B はハイブリッド注意機構を持つ（25層 SWA + 5層 Global Attention）。

- `fused-turboquant`（PyPI 公式）は SWA 未対応のため **使用しない**
- `turboquant`（back2matching/turboquant）は SWA をバイパスし、5つのグローバル注意層のみ KV キャッシュを **3.8x 圧縮**する

インストールは PyPI 版ではなく GitHub リポジトリを直接指定すること:

```bash
pip install git+https://github.com/back2matching/turboquant.git@acef33bf44abbd4623e11a48aae5f9a60aaf9ac0
```

これにより 16GB VRAM でモデル重みの他に十分なキャッシュ余裕を確保できる。

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
| Template Name | `techclip-gemma4-26b-int4` |
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
MODEL_ID=Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound
```

### デフォルト環境変数

```env
MODEL_ID=Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound
HF_HOME=/runpod-volume/hf-cache
TRANSFORMERS_OFFLINE=1
```

> **重要**: `TRANSFORMERS_OFFLINE=1` のため、コンテナ起動前にモデルを `/runpod-volume/hf-cache` へ事前ダウンロードしておくこと。RunPod コンソールの **Cached Models** 機能を使うか、以下のコマンドで手動ダウンロードすること:
>
> ```bash
> HF_HOME=/runpod-volume/hf-cache python3 -c "
> from transformers import AutoModelForCausalLM, AutoProcessor
> AutoModelForCausalLM.from_pretrained('Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound')
> AutoProcessor.from_pretrained('Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound')
> "
> ```

## トラブルシューティング

### OOM エラーが発生する場合

16GB VRAM GPU（RTX 4080 / A4000）を使用していること、および他のプロセスが VRAM を占有していないことを確認する。改善しない場合は 24GB 以上の GPU に変更する。

### TurboQuant パッチが失敗する場合

ハンドラーは TurboQuant のパッチ適用失敗を警告として記録し、圧縮なしで推論を続行する。
ログに `TurboQuant パッチの適用に失敗しました` と出ている場合は turboquant パッケージのインストール状況を確認する。

### コールドスタートが遅い場合

`FlashBoot` と `Cached Models` を有効にする。`HF_HOME=/runpod-volume/hf-cache` を設定してモデルキャッシュを永続ボリュームに保存することで、2回目以降の起動を大幅に短縮できる。

### タイムアウトが発生する場合

エンドポイントの **Execution Timeout** を増やす（推奨: 300 秒）。

## バージョン管理

以下の組み合わせで動作確認済み:

| コンポーネント | バージョン | 備考 |
|----------------|------------|------|
| ベースイメージ（builder） | `runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04` | Python + PyTorch + CUDA 同梱 |
| ベースイメージ（runtime） | `runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-runtime-ubuntu22.04` | 軽量 runtime |
| Python | `3.11` | ベースイメージに同梱 |
| torch | `2.8.0` | ベースイメージに同梱 |
| transformers | `4.51.3` | Gemma 4 対応 |
| turboquant | `@acef33bf44abbd4623e11a48aae5f9a60aaf9ac0`（back2matching/turboquant） | SWA バイパス対応・PyPI 版は使用しない |
| auto-round | `0.5.3` | Intel AutoRound int4 サポート |
| accelerate | `1.6.0` | デバイスマップサポート |
| RunPod SDK | `1.7.4` | サーバーレスランタイム |

バージョンを変更する場合は `requirements.txt` と `Dockerfile` を更新し、動作確認後にこのテーブルを更新すること。
