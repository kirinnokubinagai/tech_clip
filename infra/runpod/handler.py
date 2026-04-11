"""
RunPodサーバーレスハンドラー

Google Gemma 3 12B IT モデル（AWQ/GPTQ 量子化対応）を vLLM で起動し、
RunPod サーバーレス API のリクエストを処理する。

リクエスト形式:
    {"input": {"messages": [{"role": "user", "content": "..."}], "max_tokens": 4096}}

レスポンス形式:
    {"output": {"choices": [{"message": {"role": "assistant", "content": "..."}}]}}

モデル名は以下の優先順で解決する:
    GEMMA_MODEL_NAME 環境変数 -> MODEL_PATH 環境変数 -> MODEL_NAME 環境変数 -> デフォルト

量子化は VLLM_QUANTIZATION 環境変数で制御する（awq / gptq_marlin / fp8 / 空で非量子化）。
"""

import os
from typing import Any
import runpod
from vllm import LLM, SamplingParams

# メッセージ本文の最大文字数
MESSAGE_CONTENT_MAX_LENGTH = 50000

# max_tokens の最大値
MAX_TOKENS_LIMIT = 8192

# モデル参照の解決優先順位:
#   1. GEMMA_MODEL_NAME (Gemma 系切り替え用の専用変数)
#   2. MODEL_PATH (汎用パス指定)
#   3. MODEL_NAME (Dockerfile からの注入)
#   4. デフォルト (google/gemma-3-12b-it)
MODEL_REF = (
    os.environ.get("GEMMA_MODEL_NAME")
    or os.environ.get("MODEL_PATH")
    or os.environ.get("MODEL_NAME", "google/gemma-3-12b-it")
)
MAX_MODEL_LEN = int(os.environ.get("MAX_MODEL_LEN", "8192"))
MAX_NUM_SEQS = int(os.environ.get("MAX_NUM_SEQS", "4"))
GPU_MEMORY_UTILIZATION = float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.90"))
TENSOR_PARALLEL_SIZE = int(os.environ.get("TENSOR_PARALLEL_SIZE", "1"))

# 量子化設定: 環境変数 VLLM_QUANTIZATION で制御する
# awq / gptq_marlin / fp8 を指定するか、空文字・未設定で非量子化（後方互換）
VLLM_QUANTIZATION = os.environ.get("VLLM_QUANTIZATION") or None

# AWQ 量子化時は "auto" を推奨。非量子化時は "bfloat16" を維持する
VLLM_DTYPE = os.environ.get("VLLM_DTYPE", "bfloat16")

llm_kwargs: dict = {
    "model": MODEL_REF,
    "dtype": VLLM_DTYPE,
    "max_model_len": MAX_MODEL_LEN,
    "max_num_seqs": MAX_NUM_SEQS,
    "gpu_memory_utilization": GPU_MEMORY_UTILIZATION,
    "tensor_parallel_size": TENSOR_PARALLEL_SIZE,
}
if VLLM_QUANTIZATION:
    llm_kwargs["quantization"] = VLLM_QUANTIZATION

llm = LLM(**llm_kwargs)


def validate_messages(messages: Any) -> list[dict]:
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
        if len(msg["content"]) > MESSAGE_CONTENT_MAX_LENGTH:
            raise ValueError(
                f"messages[{i}].content は {MESSAGE_CONTENT_MAX_LENGTH} 文字以内である必要があります"
            )

    return messages


def validate_max_tokens(value: Any) -> int:
    """
    max_tokens の値を検証する。

    Args:
        value: 検証対象の max_tokens 値

    Returns:
        検証済み max_tokens 整数値

    Raises:
        ValueError: 型・範囲が不正な場合
    """
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("max_tokens は整数である必要があります")
    if value <= 0 or value > MAX_TOKENS_LIMIT:
        raise ValueError(f"max_tokens は 1 以上 {MAX_TOKENS_LIMIT} 以下である必要があります")
    return value


def validate_temperature(value: Any) -> float:
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
    if temperature < 0.0 or temperature > 1.0:
        raise ValueError("temperature は 0.0 以上 1.0 以下である必要があります")
    return temperature


def handle_messages_request(job_input: dict) -> dict:
    """
    messages キーを使ったリクエストを処理する（要約・翻訳共通）。

    Args:
        job_input: {"messages": [{"role": "user", "content": "..."}], "max_tokens": 4096}

    Returns:
        {"choices": [{"message": {"role": "assistant", "content": "..."}}]}

    Raises:
        ValueError: 入力バリデーション失敗時
    """
    messages = validate_messages(job_input["messages"])
    raw_max_tokens = job_input.get("max_tokens", 4096)
    max_tokens = validate_max_tokens(raw_max_tokens)
    raw_temperature = job_input.get("temperature", 0.3)
    temperature = validate_temperature(raw_temperature)

    tokenizer = llm.get_tokenizer()
    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    sampling_params = SamplingParams(
        max_tokens=max_tokens,
        temperature=temperature,
    )

    outputs = llm.generate([prompt], sampling_params)
    generated_text = outputs[0].outputs[0].text

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

    Gemma 3 では messages 形式のみをサポートする。

    Args:
        job: RunPod ジョブオブジェクト（{"input": {...}}）

    Returns:
        生成結果（{"output": {...}} 形式）
    """
    job_input = job.get("input", {})

    if "messages" not in job_input:
        return {"error": "input に messages キーが必要です"}

    try:
        output = handle_messages_request(job_input)
    except ValueError as e:
        return {"error": str(e)}

    return {"output": output}


runpod.serverless.start({"handler": handler})
