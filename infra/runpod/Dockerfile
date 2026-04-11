FROM nvidia/cuda:12.8.0-cudnn9-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-pip git && \
    rm -rf /var/lib/apt/lists/*

# CUDA 対応 PyTorch（Transformers の基盤）
RUN python3.12 -m pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cu128

# TurboQuant（SWA バイパス付き、Gemma 4 対応）
# back2matching/turboquant は Gemma 4 のハイブリッド注意機構（SWA）をバイパスし、
# グローバル注意層のみ KV キャッシュを圧縮する。
# fused-turboquant（PyPI 公式）は SWA 未対応のため使用しない。
RUN python3.12 -m pip install --no-cache-dir turboquant

# HuggingFace Transformers + RunPod SDK
RUN python3.12 -m pip install --no-cache-dir \
    "transformers>=4.51.0" \
    accelerate \
    auto-round \
    "runpod>=1.7.4"

WORKDIR /app
COPY handler.py .

# モデル ID は環境変数で上書き可能
ENV MODEL_ID=Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound

# モデルキャッシュをボリュームマウントへ（コールドスタート対策）
ENV HF_HOME=/runpod-volume/hf-cache
ENV TRANSFORMERS_OFFLINE=0

CMD ["python3.12", "-u", "handler.py"]
