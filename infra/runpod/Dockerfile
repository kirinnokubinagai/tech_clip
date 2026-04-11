# Stage 1: builder（devel イメージでパッケージをインストール）
FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04 AS builder

RUN pip install --no-cache-dir \
    transformers==4.51.3 \
    accelerate==1.6.0 \
    auto-round==0.5.3 \
    runpod==1.7.4 \
    git+https://github.com/back2matching/turboquant.git@main

# Stage 2: runtime（軽量イメージ）
FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-runtime-ubuntu22.04

# site-packages とビルド成果物をコピー
COPY --from=builder /usr/local/lib/python3.11/dist-packages /usr/local/lib/python3.11/dist-packages

# 非 root ユーザーを作成
RUN useradd -m -u 1000 appuser \
    && mkdir -p /app /runpod-volume \
    && chown -R appuser /app /runpod-volume

WORKDIR /app
COPY handler.py .
RUN chown appuser /app/handler.py

USER appuser

# モデル ID は環境変数で上書き可能
ENV MODEL_ID=Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound

# モデルキャッシュをボリュームマウントへ（コールドスタート対策）
ENV HF_HOME=/runpod-volume/hf-cache

# オフラインモード: モデルは /runpod-volume/hf-cache に事前ダウンロードしておくこと
ENV TRANSFORMERS_OFFLINE=1

CMD ["python3.11", "-u", "handler.py"]
