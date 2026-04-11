# vLLM 公式イメージ（PyTorch + CUDA 同梱）
FROM vllm/vllm-openai:v0.9.0@sha256:df2c55e5107afea09ea1a50f9dd96c99ebf97a795334c4d08f691f3d79b2ab12

# 追加パッケージをインストール
RUN pip install --no-cache-dir \
    runpod==1.7.4 \
    git+https://github.com/0xSero/turboquant.git@7ac9b8d165a3f7d5e6df33b0450bc1f88ec0d4d5

# 非 root ユーザー
RUN useradd -m -u 1000 appuser \
    && mkdir -p /app \
    && chown -R appuser /app

WORKDIR /app
COPY --chown=appuser:appuser handler.py .

USER appuser

ENV MODEL_ID=raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4
ENV HF_HOME=/runpod-volume/hf-cache
# TRANSFORMERS_OFFLINE=1: ネットワークボリューム（HF_HOME）へのモデル事前ダウンロードが必須
ENV TRANSFORMERS_OFFLINE=1

CMD ["python", "-u", "handler.py"]
