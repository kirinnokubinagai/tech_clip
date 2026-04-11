"""
RunPod サーバーレスハンドラー

Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound モデルを
HuggingFace Transformers でロードし、RunPod サーバーレス API のリクエストを処理する。

TurboQuant（back2matching/turboquant）を使って KV キャッシュを圧縮する。
Gemma 4 のハイブリッド注意機構（25層 SWA + 5層 Global Attention）に対応しており、
グローバル注意層のみ 3.8x の KV キャッシュ圧縮を適用する。

リクエスト形式:
    {
        "input": {
            "messages": [{"role": "user", "content": "..."}],
            "max_new_tokens": 512,
            "temperature": 0.7,
            "top_p": 0.9
        }
    }

レスポンス形式:
    {"output": {"choices": [{"message": {"role": "assistant", "content": "..."}}]}}
"""

import logging
import os
from typing import Any

import runpod
import torch
from transformers import AutoModelForCausalLM, AutoProcessor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# デフォルトモデル ID（環境変数で上書き可能）
DEFAULT_MODEL_ID = "Intel/gemma-4-26B-A4B-it-int4-mixed-AutoRound"

# メッセージ本文の最大文字数
MESSAGE_CONTENT_MAX_LENGTH = 50000

# max_new_tokens の上限・デフォルト値
MAX_NEW_TOKENS_LIMIT = 2048
DEFAULT_MAX_NEW_TOKENS = 512

# temperature の有効範囲
TEMPERATURE_MIN = 0.0
TEMPERATURE_MAX = 2.0
DEFAULT_TEMPERATURE = 0.7

# top_p の有効範囲
TOP_P_MIN = 0.0
TOP_P_MAX = 1.0
DEFAULT_TOP_P = 0.9

# TurboQuant KV キャッシュ圧縮ビット数
TURBOQUANT_BITS = 4

MODEL_ID: str = os.environ.get("MODEL_ID", DEFAULT_MODEL_ID)

# グローバルモデル（コールドスタート時のみロード）
_model: AutoModelForCausalLM | None = None
_processor: AutoProcessor | None = None


def _load_model() -> tuple[AutoModelForCausalLM, AutoProcessor]:
    """
    モデルとプロセッサをロードする。

    TurboQuant によるKVキャッシュ圧縮を試みる。
    patch_model が失敗した場合は警告を出して続行する。

    Returns:
        (model, processor) のタプル
    """
    logger.info("モデルをロード中: %s", MODEL_ID)

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        device_map="auto",
        torch_dtype="auto",
    )
    processor = AutoProcessor.from_pretrained(MODEL_ID)

    logger.info("モデルのロード完了。TurboQuant パッチを適用中...")

    try:
        import turboquant  # type: ignore[import-untyped]

        if hasattr(turboquant, "patch_model"):
            turboquant.patch_model(model, bits=TURBOQUANT_BITS)
            logger.info("turboquant.patch_model の適用完了（bits=%d）", TURBOQUANT_BITS)
        elif hasattr(turboquant, "hf") and hasattr(turboquant.hf, "patch_model"):
            turboquant.hf.patch_model(model, bits=TURBOQUANT_BITS)
            logger.info("turboquant.hf.patch_model の適用完了（bits=%d）", TURBOQUANT_BITS)
        else:
            logger.warning(
                "turboquant に patch_model が見つかりません。KV キャッシュ圧縮をスキップします"
            )
    except Exception as e:
        logger.warning(
            "TurboQuant パッチの適用に失敗しました（%s: %s）。圧縮なしで続行します",
            type(e).__name__,
            e,
        )

    return model, processor


def _get_model() -> tuple[AutoModelForCausalLM, AutoProcessor]:
    """
    グローバルモデルを返す。未初期化の場合はロードする。

    Returns:
        (model, processor) のタプル
    """
    global _model, _processor
    if _model is None or _processor is None:
        _model, _processor = _load_model()
    return _model, _processor


def _validate_messages(messages: Any) -> list[dict]:
    """
    messages の型・内容を検証する。

    Args:
        messages: 検証対象の messages 値

    Returns:
        検証済み messages リスト

    Raises:
        ValueError: 形式が不正な場合
    """
    if not isinstance(messages, list):
        raise ValueError("messages はリスト形式である必要があります")
    if len(messages) == 0:
        raise ValueError("messages は 1 件以上必要です")

    valid_roles = {"user", "assistant", "system"}
    for i, msg in enumerate(messages):
        if not isinstance(msg, dict):
            raise ValueError(f"messages[{i}] はオブジェクト形式である必要があります")
        role = msg.get("role")
        if isinstance(role, bool) or not isinstance(role, str) or role not in valid_roles:
            raise ValueError(
                f"messages[{i}].role は {valid_roles} のいずれかである必要があります"
            )
        content = msg.get("content")
        if isinstance(content, bool) or not isinstance(content, str):
            raise ValueError(f"messages[{i}].content は文字列である必要があります")
        if len(content) > MESSAGE_CONTENT_MAX_LENGTH:
            raise ValueError(
                f"messages[{i}].content は {MESSAGE_CONTENT_MAX_LENGTH} 文字以内である必要があります"
            )

    return messages


def _validate_max_new_tokens(value: Any) -> int:
    """
    max_new_tokens の値を検証する。

    Args:
        value: 検証対象の max_new_tokens 値

    Returns:
        検証済み max_new_tokens 整数値

    Raises:
        ValueError: 型・範囲が不正な場合
    """
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("max_new_tokens は整数である必要があります")
    if value <= 0 or value > MAX_NEW_TOKENS_LIMIT:
        raise ValueError(
            f"max_new_tokens は 1 以上 {MAX_NEW_TOKENS_LIMIT} 以下である必要があります"
        )
    return value


def _validate_temperature(value: Any) -> float:
    """
    temperature の値を検証する。

    Args:
        value: 検証対象の temperature 値

    Returns:
        検証済み temperature 浮動小数点数値

    Raises:
        ValueError: 型・範囲が不正な場合
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("temperature は数値である必要があります")
    temperature = float(value)
    if temperature < TEMPERATURE_MIN or temperature > TEMPERATURE_MAX:
        raise ValueError(
            f"temperature は {TEMPERATURE_MIN} 以上 {TEMPERATURE_MAX} 以下である必要があります"
        )
    return temperature


def _validate_top_p(value: Any) -> float:
    """
    top_p の値を検証する。

    Args:
        value: 検証対象の top_p 値

    Returns:
        検証済み top_p 浮動小数点数値

    Raises:
        ValueError: 型・範囲が不正な場合
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("top_p は数値である必要があります")
    top_p = float(value)
    if top_p < TOP_P_MIN or top_p > TOP_P_MAX:
        raise ValueError(
            f"top_p は {TOP_P_MIN} 以上 {TOP_P_MAX} 以下である必要があります"
        )
    return top_p


def _generate(job_input: dict) -> dict:
    """
    messages 形式のリクエストを処理し、テキストを生成する。

    Args:
        job_input: {
            "messages": [...],
            "max_new_tokens": 512,
            "temperature": 0.7,
            "top_p": 0.9
        }

    Returns:
        {"choices": [{"message": {"role": "assistant", "content": "..."}}]}

    Raises:
        ValueError: 入力バリデーション失敗時
    """
    messages = _validate_messages(job_input["messages"])
    max_new_tokens = _validate_max_new_tokens(
        job_input.get("max_new_tokens", DEFAULT_MAX_NEW_TOKENS)
    )
    temperature = _validate_temperature(
        job_input.get("temperature", DEFAULT_TEMPERATURE)
    )
    top_p = _validate_top_p(job_input.get("top_p", DEFAULT_TOP_P))

    model, processor = _get_model()

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_tensors="pt",
        return_dict=True,
    )
    inputs = inputs.to(model.device)
    input_len = inputs["input_ids"].shape[-1]

    with torch.inference_mode():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=True,
        )

    # 入力トークンを除いた生成部分のみデコード
    generated_ids = output_ids[:, input_len:]
    generated_text: str = processor.decode(generated_ids[0], skip_special_tokens=True)

    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": generated_text,
                }
            }
        ]
    }


def handler(job: dict) -> dict:
    """
    RunPod サーバーレスハンドラーのエントリーポイント。

    Args:
        job: RunPod ジョブオブジェクト（{"input": {...}}）

    Returns:
        生成結果（{"output": {...}} 形式）またはエラー（{"error": "..."} 形式）
    """
    job_input = job.get("input", {})

    if "messages" not in job_input:
        return {"error": "input に messages キーが必要です"}

    try:
        output = _generate(job_input)
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        logger.error("推論エラー: %s: %s", type(e).__name__, e)
        return {"error": f"推論エラーが発生しました: {type(e).__name__}"}

    return {"output": output}


runpod.serverless.start({"handler": handler})
