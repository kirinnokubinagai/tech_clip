FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04

WORKDIR /app

# vLLM と RunPod サーバーレスランタイムのみを入れる。
# モデルは image に焼かず、RunPod の cached models / Hugging Face cache を使う。
RUN pip install --no-cache-dir \
    vllm==0.7.3 \
    runpod==1.7.4

# ハンドラーをコピー
COPY handler.py .

# デフォルトは Google の Gemma 3 12B IT AWQ 量子化済みモデル。
# GEMMA_MODEL_NAME 環境変数で HuggingFace モデル名を差し替え可能。
ARG MODEL_NAME=abhishek/gemma-3-12b-it-awq
ENV MODEL_NAME=${MODEL_NAME}
ENV MODEL_PATH=${MODEL_NAME}

# 量子化設定（awq / gptq_marlin / fp8 / 空文字で非量子化）
# AWQ 量子化済みモデルを使う場合は "awq" を設定する
ENV VLLM_QUANTIZATION=awq

# AWQ 量子化時は dtype=auto を推奨（vLLM が自動でカーネルを選択する）
ENV VLLM_DTYPE=auto

# 量子化で VRAM に余裕が出るため非量子化より大きく設定できる
ENV MAX_MODEL_LEN=8192
ENV MAX_NUM_SEQS=4
ENV GPU_MEMORY_UTILIZATION=0.90
ENV TENSOR_PARALLEL_SIZE=1

CMD ["python", "-u", "handler.py"]
