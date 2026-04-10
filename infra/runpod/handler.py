"""
RunPodサーバーレスハンドラー

Google Gemma 3 12B IT モデルを vLLM で起動し、RunPod サーバーレス API のリクエストを処理する。

リクエスト形式:
    {"input": {"messages": [{"role": "user", "content": "..."}], "max_tokens": 4096}}

レスポンス形式:
    {"output": {"choices": [{"message": {"role": "assistant", "content": "..."}}]}}

モデル名は以下の優先順で解決する:
    GEMMA_MODEL_NAME 環境変数 -> MODEL_PATH 環境変数 -> MODEL_NAME 環境変数 -> デフォルト
"""

import os
import runpod
from vllm import LLM, SamplingParams

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
MAX_MODEL_LEN = int(os.environ.get("MAX_MODEL_LEN", "4096"))
MAX_NUM_SEQS = int(os.environ.get("MAX_NUM_SEQS", "2"))
GPU_MEMORY_UTILIZATION = float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.85"))
TENSOR_PARALLEL_SIZE = int(os.environ.get("TENSOR_PARALLEL_SIZE", "1"))

# Gemma は量子化なしのネイティブ fp16/bf16 を想定する。
# 16GB GPU で動かす場合は MAX_MODEL_LEN と MAX_NUM_SEQS を小さく保つ。
llm = LLM(
    model=MODEL_REF,
    dtype="bfloat16",
    max_model_len=MAX_MODEL_LEN,
    max_num_seqs=MAX_NUM_SEQS,
    gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
    tensor_parallel_size=TENSOR_PARALLEL_SIZE,
    trust_remote_code=True,
)


def handle_messages_request(job_input: dict) -> dict:
    """
    messages キーを使ったリクエストを処理する（要約・翻訳共通）。

    Args:
        job_input: {"messages": [{"role": "user", "content": "..."}], "max_tokens": 4096}

    Returns:
        {"choices": [{"message": {"role": "assistant", "content": "..."}}]}
    """
    messages = job_input["messages"]
    max_tokens = job_input.get("max_tokens", 4096)
    temperature = job_input.get("temperature", 0.3)

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

    output = handle_messages_request(job_input)
    return {"output": output}


runpod.serverless.start({"handler": handler})
