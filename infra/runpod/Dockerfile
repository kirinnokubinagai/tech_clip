FROM runpod/pytorch:2.6.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# vLLM と依存パッケージのインストール
RUN pip install --no-cache-dir \
    vllm==0.7.3 \
    runpod==1.7.4 \
    huggingface-hub==0.25.2

# ハンドラーをコピー
COPY handler.py .

# Qwen3.5-9B モデルのダウンロード
# Qwen3.5 では -Instruct サフィックスが廃止。Qwen3.5-9B がチャット/指示対応版。
# ベースモデル（非Instruct）は Qwen3.5-9B-Base。
# 参考: https://huggingface.co/Qwen/Qwen3.5-9B
ARG MODEL_NAME=Qwen/Qwen3.5-9B
ENV MODEL_NAME=${MODEL_NAME}
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('${MODEL_NAME}', local_dir='/models/qwen3.5')"

ENV MODEL_PATH=/models/qwen3.5

CMD ["python", "-u", "handler.py"]
