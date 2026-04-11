"""
RunPod サーバーレスハンドラー

raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4 モデルを
vLLM でロードし、RunPod サーバーレス API のリクエストを処理する。

0xSero/turboquant を vLLM integration API で統合し、
KV キャッシュを圧縮することで VRAM 効率を向上させる。

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
from vllm import LLM, SamplingParams

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# デフォルトモデル ID（環境変数で上書き可能）
DEFAULT_MODEL_ID = "raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4"

# 許可するモデル ID の一覧
ALLOWED_MODEL_IDS: frozenset[str] = frozenset({
    "raydelossantos/gemma-4-26B-A4B-it-GPTQ-Int4",
})

# メッセージ本文の最大文字数
MESSAGE_CONTENT_MAX_LENGTH = 50000

# 1 リクエストあたりの最大メッセージ数
MAX_MESSAGES_COUNT = 100

# max_new_tokens の上限・デフォルト値
MAX_NEW_TOKENS_LIMIT = 2048
DEFAULT_MAX_NEW_TOKENS = 512

# temperature の有効範囲
TEMPERATURE_MIN = 0.0
TEMPERATURE_MAX = 2.0
DEFAULT_TEMPERATURE = 0.7

# temperature がこの値以下の場合は決定論的生成（greedy）
TEMPERATURE_GREEDY_THRESHOLD = 0.0

# top_p の有効範囲
TOP_P_MIN = 0.0
TOP_P_MAX = 1.0
DEFAULT_TOP_P = 0.9

# GPU メモリ使用率（0.0 ~ 1.0）
GPU_MEMORY_UTILIZATION = 0.90

# TurboQuant KV キャッシュ圧縮設定
TURBOQUANT_KEY_BITS = 3
TURBOQUANT_VALUE_BITS = 2
TURBOQUANT_BUFFER_SIZE = 128

MODEL_ID: str = os.environ.get("MODEL_ID", DEFAULT_MODEL_ID)

# グローバルモデル（コールドスタート時のみロード）
_llm: LLM | None = None
_tokenizer: Any | None = None


def _install_turboquant_hooks(llm_instance: LLM) -> int:
    """
    vLLM エンジンに TurboQuant フックをインストールする。

    Args:
        llm_instance: フックをインストールする LLM インスタンス

    Returns:
        インストールされたフック数
    """
    try:
        from turboquant.vllm_attn_backend import (
            install_turboquant_hooks,
            MODE_ACTIVE,
        )

        engine = llm_instance.llm_engine
        core = getattr(engine, "engine_core", engine)
        inner = getattr(core, "engine_core", core)
        executor = inner.model_executor

        def _install(worker):
            return len(
                install_turboquant_hooks(
                    worker.model_runner,
                    key_bits=TURBOQUANT_KEY_BITS,
                    value_bits=TURBOQUANT_VALUE_BITS,
                    buffer_size=TURBOQUANT_BUFFER_SIZE,
                    mode=MODE_ACTIVE,
                )
            )

        hooks = executor.collective_rpc(_install)
        hook_count = hooks[0] if hooks else 0
        logger.info(
            "TurboQuant フックのインストール完了（%d 層、key_bits=%d、value_bits=%d）",
            hook_count,
            TURBOQUANT_KEY_BITS,
            TURBOQUANT_VALUE_BITS,
        )
        return hook_count
    except Exception as e:
        logger.warning(
            "TurboQuant フックのインストールに失敗しました（%s: %s）。圧縮なしで続行します",
            type(e).__name__,
            e,
        )
        return 0


def _load_model() -> tuple[LLM, Any]:
    """
    vLLM で GPTQ モデルをロードし、TurboQuant フックをインストールする。

    Returns:
        (llm, tokenizer) のタプル
    """
    if MODEL_ID not in ALLOWED_MODEL_IDS:
        raise ValueError(f"許可されていないモデルID: {MODEL_ID}")

    logger.info("モデルをロード中: %s", MODEL_ID)

    llm = LLM(
        model=MODEL_ID,
        quantization="gptq",
        dtype="float16",
        gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
        max_model_len=4096,
        trust_remote_code=False,  # GPTQ は transformers 本体でサポート
        max_num_seqs=1,
    )

    tokenizer = llm.get_tokenizer()

    logger.info("モデルのロード完了。TurboQuant フックをインストール中...")
    _install_turboquant_hooks(llm)

    return llm, tokenizer


def _get_model() -> tuple[LLM, Any]:
    """
    グローバルモデルを返す。未初期化の場合はロードする。

    Returns:
        (llm, tokenizer) のタプル
    """
    global _llm, _tokenizer
    if _llm is None or _tokenizer is None:
        _llm, _tokenizer = _load_model()
    return _llm, _tokenizer


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
    if len(messages) > MAX_MESSAGES_COUNT:
        raise ValueError(f"メッセージ数が上限（{MAX_MESSAGES_COUNT}件）を超えています")

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
    messages = _validate_messages(job_input.get("messages", []))
    max_new_tokens = _validate_max_new_tokens(
        job_input.get("max_new_tokens", DEFAULT_MAX_NEW_TOKENS)
    )
    temperature = _validate_temperature(
        job_input.get("temperature", DEFAULT_TEMPERATURE)
    )
    top_p = _validate_top_p(job_input.get("top_p", DEFAULT_TOP_P))

    llm, tokenizer = _get_model()

    prompt = tokenizer.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=False,
    )

    use_greedy = temperature <= TEMPERATURE_GREEDY_THRESHOLD
    if use_greedy:
        sampling_params = SamplingParams(
            max_tokens=max_new_tokens,
            temperature=0.0,
        )
    else:
        sampling_params = SamplingParams(
            max_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
        )

    outputs = llm.generate([prompt], sampling_params)
    generated_text: str = outputs[0].outputs[0].text

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
    except torch.cuda.OutOfMemoryError:
        logger.error("GPU メモリ不足エラー", exc_info=True)
        return {"error": "推論エラーが発生しました"}
    except Exception:
        logger.error("推論エラー", exc_info=True)
        return {"error": "推論エラーが発生しました"}

    return {"output": output}


runpod.serverless.start({"handler": handler})
