FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04

WORKDIR /app

# vLLM と RunPod サーバーレスランタイムのみを入れる。
# モデルは image に焼かず、RunPod の cached models / Hugging Face cache を使う。
RUN pip install --no-cache-dir \
    vllm==0.7.3 \
    runpod==1.7.4

# ハンドラーをコピー
COPY handler.py .

# 16GB GPU を狙うため、量子化済み AWQ モデルをデフォルトにする。
ARG MODEL_NAME=QuantTrio/Qwen3.5-9B-AWQ
ENV MODEL_NAME=${MODEL_NAME}
ENV MODEL_PATH=${MODEL_NAME}
ENV VLLM_QUANTIZATION=awq
ENV MAX_MODEL_LEN=2048
ENV MAX_NUM_SEQS=2
ENV GPU_MEMORY_UTILIZATION=0.85
ENV TENSOR_PARALLEL_SIZE=1

CMD ["python", "-u", "handler.py"]
