# Stage 1: builder（vLLM 公式イメージでパッケージをインストール）
FROM vllm/vllm-openai:v0.9.0 AS builder

# 0xSero/turboquant を固定コミットでインストール
RUN pip install --no-cache-dir --target /opt/app-packages \
    runpod==1.7.4 \
    git+https://github.com/0xSero/turboquant.git@7ac9b8d165a3f7d5e6df33b0450bc1f88ec0d4d5

# Stage 2: runtime（vLLM 公式 runtime イメージ）
FROM vllm/vllm-openai:v0.9.0

# builder ステージでインストールした追加パッケージをコピー
COPY --from=builder /opt/app-packages /opt/app-packages
ENV PYTHONPATH=/opt/app-packages

# 非 root ユーザーを作成
RUN useradd -m -u 1000 appuser \
    && mkdir -p /app \
    && chown -R appuser /app

WORKDIR /app
COPY --chown=appuser:appuser handler.py .

USER appuser

# モデル ID は環境変数で上書き可能（GPTQ Int4）
ENV MODEL_ID=raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4

# モデルキャッシュをボリュームマウントへ（コールドスタート対策）
ENV HF_HOME=/runpod-volume/hf-cache

# オフラインモード: モデルは /runpod-volume/hf-cache に事前ダウンロードしておくこと
ENV TRANSFORMERS_OFFLINE=1

CMD ["python", "-u", "handler.py"]
