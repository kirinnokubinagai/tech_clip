# Stage 1: builder（devel イメージでパッケージをインストール）
FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04 AS builder

RUN pip install --no-cache-dir --target /opt/app-packages \
    transformers==4.51.3 \
    accelerate==1.6.0 \
    auto-round==0.5.3 \
    runpod==1.7.4 \
    git+https://github.com/back2matching/turboquant.git@acef33bf44abbd4623e11a48aae5f9a60aaf9ac0

# Stage 2: runtime（軽量イメージ）
FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-runtime-ubuntu22.04

# builder ステージでインストールしたパッケージをコピー（devel 固有ファイルを除外）
COPY --from=builder /opt/app-packages /opt/app-packages
ENV PYTHONPATH=/opt/app-packages

# 非 root ユーザーを作成
RUN useradd -m -u 1000 appuser \
    && mkdir -p /app \
    && chown -R appuser /app

WORKDIR /app
COPY --chown=appuser:appuser handler.py .

USER appuser

# モデル ID は環境変数で上書き可能
ENV MODEL_ID=Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound

# モデルキャッシュをボリュームマウントへ（コールドスタート対策）
ENV HF_HOME=/runpod-volume/hf-cache

# オフラインモード: モデルは /runpod-volume/hf-cache に事前ダウンロードしておくこと
ENV TRANSFORMERS_OFFLINE=1

CMD ["python", "-u", "handler.py"]
