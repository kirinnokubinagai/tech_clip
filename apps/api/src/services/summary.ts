import { DEFAULT_GEMMA_MODEL_TAG } from "../lib/ai-model";

/** RunPod接続設定 */
export type RunPodConfig = {
  apiKey: string;
  endpointId: string;
  /** データベース保存用のモデルタグ（省略時は DEFAULT_GEMMA_MODEL_TAG を使用） */
  modelTag?: string;
};

/** 要約生成結果 */
export type SummaryResult = {
  summary: string;
  model: string;
};

export type SummaryJobResult = {
  providerJobId: string;
  model: string;
};

export type SummaryJobStatus =
  | { status: "queued" | "running"; model: string }
  | { status: "completed"; model: string; summary: string }
  | { status: "failed"; model: string; error: string };

/** summarizeArticle関数のパラメータ */
type SummarizeArticleParams = {
  content: string;
  language: string;
  config: RunPodConfig;
  fetchFn?: typeof fetch;
};

/** コンテンツの最大文字数（約8000トークン相当） */
const MAX_CONTENT_LENGTH = 24000;

/** RunPod API ベースURL */
const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

/** RunPod APIのポーリング間隔（ミリ秒） */
const POLLING_INTERVAL_MS = 2000;

/** RunPod APIのポーリング最大回数 */
const MAX_POLLING_ATTEMPTS = 60;

/** 要約生成時の最大トークン数 */
const SUMMARY_MAX_TOKENS = 1024;

/** 要約生成時の temperature */
const SUMMARY_TEMPERATURE = 0.3;

/** 言語名マッピング */
const LANGUAGE_NAMES: Record<string, string> = {
  ja: "Japanese",
  en: "English",
  zh: "Chinese",
  ko: "Korean",
};

/**
 * 使用するモデルタグを解決する
 *
 * @param config - RunPod接続設定
 * @returns modelTagが未指定の場合はデフォルトタグ
 */
function resolveModelTag(config: RunPodConfig): string {
  return config.modelTag ?? DEFAULT_GEMMA_MODEL_TAG;
}

function buildPrompt(content: string, language: string): string {
  const truncated =
    content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) : content;

  const languageName = LANGUAGE_NAMES[language] ?? "Japanese";

  return `Summarize the following article in ${languageName}. Provide:
1. A concise summary (2-3 sentences)
2. 3-5 key points as bullet points

Article:
${truncated}

Summary:`;
}

/** RunPod要約レスポンスの期待する構造（Gemma chat template 互換） */
type RunPodSummaryOutput = {
  output: {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  };
};

/**
 * RunPod要約レスポンスの型ガード
 *
 * @param value - 検証対象の値
 * @returns RunPodSummaryOutput型かどうか
 */
function isRunPodSummaryOutput(value: unknown): value is RunPodSummaryOutput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.output !== "object" || v.output === null) {
    return false;
  }
  const output = v.output as Record<string, unknown>;
  if (!Array.isArray(output.choices) || output.choices.length === 0) {
    return false;
  }
  const first = output.choices[0] as Record<string, unknown> | undefined;
  if (typeof first?.message !== "object" || first.message === null) {
    return false;
  }
  const message = first.message as Record<string, unknown>;
  return typeof message.content === "string";
}

function mapRunPodStatus(status: string): "queued" | "running" | "completed" | "failed" {
  if (status === "IN_QUEUE") {
    return "queued";
  }
  if (status === "COMPLETED") {
    return "completed";
  }
  if (status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT") {
    return "failed";
  }
  return "running";
}

export async function createSummaryJob(params: SummarizeArticleParams): Promise<SummaryJobResult> {
  const { content, language, config, fetchFn = fetch } = params;
  const prompt = buildPrompt(content, language);
  const runUrl = `${RUNPOD_API_BASE}/${config.endpointId}/run`;
  const modelTag = resolveModelTag(config);

  const response = await fetchFn(runUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: {
        messages: [{ role: "user", content: prompt }],
        max_tokens: SUMMARY_MAX_TOKENS,
        temperature: SUMMARY_TEMPERATURE,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RunPod API error: ${response.status}`);
  }

  const data = (await response.json()) as { id?: string };

  if (!data.id) {
    throw new Error("RunPod job create error");
  }

  return {
    providerJobId: data.id,
    model: modelTag,
  };
}

export async function getSummaryJobStatus(params: {
  providerJobId: string;
  config: RunPodConfig;
  fetchFn?: typeof fetch;
}): Promise<SummaryJobStatus> {
  const { providerJobId, config, fetchFn = fetch } = params;
  const statusUrl = `${RUNPOD_API_BASE}/${config.endpointId}/status/${providerJobId}`;
  const modelTag = resolveModelTag(config);

  const response = await fetchFn(statusUrl, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`RunPod status error: ${response.status}`);
  }

  const data = (await response.json()) as {
    status: string;
    error?: string;
    output?: unknown;
  };
  const status = mapRunPodStatus(data.status);

  if (status === "completed" && isRunPodSummaryOutput(data)) {
    return {
      status: "completed",
      model: modelTag,
      summary: data.output.choices[0].message.content,
    };
  }

  if (status === "failed") {
    return {
      status: "failed",
      model: modelTag,
      error: data.error ?? "RunPod job failed",
    };
  }

  if (status === "completed") {
    return {
      status: "failed",
      model: modelTag,
      error: "RunPod job completed without summary output",
    };
  }

  return {
    status,
    model: modelTag,
  };
}

export async function summarizeArticle(params: SummarizeArticleParams): Promise<SummaryResult> {
  const { content, language, config, fetchFn = fetch } = params;

  try {
    const job = await createSummaryJob({ content, language, config, fetchFn });

    let attempts = 0;
    while (attempts < MAX_POLLING_ATTEMPTS) {
      const status = await getSummaryJobStatus({
        providerJobId: job.providerJobId,
        config,
        fetchFn,
      });

      if (status.status === "completed") {
        return {
          summary: status.summary,
          model: status.model,
        };
      }

      if (status.status === "failed") {
        throw new Error(status.error);
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
    }

    throw new Error("RunPod job timed out");
  } catch (error) {
    if (error instanceof Error && error.message === "要約の生成に失敗しました") {
      throw error;
    }
    throw new Error("要約の生成に失敗しました");
  }
}
