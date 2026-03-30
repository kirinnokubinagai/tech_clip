FROM runpod/pytorch:2.1.0-py3.10-cuda12.1.0-devel-ubuntu22.04

WORKDIR /app

# vLLMのインストール
RUN pip install --no-cache-dir \
    vllm==0.3.3 \
    runpod==1.6.2 \
    huggingface-hub==0.21.4

# ハンドラーをコピー
COPY handler.py .

# Qwen2.5 9Bモデルのダウンロード
ARG MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
ENV MODEL_NAME=${MODEL_NAME}
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('${MODEL_NAME}', local_dir='/models/qwen2.5')"

ENV MODEL_PATH=/models/qwen2.5

CMD ["python", "-u", "handler.py"]
