"""
RunPodサーバーレスハンドラー

Qwen3.5-9BモデルをvLLMで起動し、RunPodサーバーレスAPIのリクエストを処理する。

リクエスト形式:
    {"input": {"prompt": "...", "max_tokens": 1024}}
    または
    {"input": {"messages": [{"role": "user", "content": "..."}], "max_tokens": 4096}}

レスポンス形式（promptの場合）:
    {"output": {"text": "..."}}

レスポンス形式（messagesの場合）:
    {"output": {"choices": [{"message": {"role": "assistant", "content": "..."}}]}}
"""

import os
import runpod
from vllm import LLM, SamplingParams

# モデルパス（Dockerfileで設定）
MODEL_PATH = os.environ.get("MODEL_PATH", "/models/qwen3.5")

# vLLMエンジン初期化（起動時に一度だけ実行）
llm = LLM(
    model=MODEL_PATH,
    dtype="bfloat16",
    max_model_len=8192,
    gpu_memory_utilization=0.90,
)


def handle_prompt_request(job_input: dict) -> dict:
    """
    promptキーを使ったリクエストを処理する（要約用）。

    Args:
        job_input: {"prompt": "...", "max_tokens": 1024, "temperature": 0.3}

    Returns:
        {"text": "生成されたテキスト"}
    """
    prompt = job_input["prompt"]
    max_tokens = job_input.get("max_tokens", 1024)
    temperature = job_input.get("temperature", 0.7)

    sampling_params = SamplingParams(
        max_tokens=max_tokens,
        temperature=temperature,
    )

    outputs = llm.generate([prompt], sampling_params)
    generated_text = outputs[0].outputs[0].text

    return {"text": generated_text}


def handle_messages_request(job_input: dict) -> dict:
    """
    messagesキーを使ったリクエストを処理する（翻訳用）。

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
    RunPodサーバーレスハンドラーのエントリーポイント。

    promptキーとmessagesキーの両形式に対応する。

    Args:
        job: RunPodジョブオブジェクト（{"input": {...}}）

    Returns:
        生成結果（{"output": {...}}形式）
    """
    job_input = job.get("input", {})

    if "messages" in job_input:
        output = handle_messages_request(job_input)
    elif "prompt" in job_input:
        output = handle_prompt_request(job_input)
    else:
        return {"error": "inputにpromptまたはmessagesキーが必要です"}

    return {"output": output}


runpod.serverless.start({"handler": handler})
