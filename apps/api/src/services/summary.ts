/** RunPod接続設定 */
export type RunPodConfig = {
  apiKey: string;
  endpointId: string;
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

/** RunPodモデル名 */
const MODEL_NAME = "qwen3.5-9b";

/** RunPod API ベースURL */
const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

/** RunPod APIのポーリング間隔（ミリ秒） */
const POLLING_INTERVAL_MS = 2000;

/** RunPod APIのポーリング最大回数 */
const MAX_POLLING_ATTEMPTS = 60;

/** 言語名マッピング */
const LANGUAGE_NAMES: Record<string, string> = {
  ja: "Japanese",
  en: "English",
  zh: "Chinese",
  ko: "Korean",
};

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

  const response = await fetchFn(runUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: {
        prompt,
        max_tokens: 1024,
        temperature: 0.3,
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
    model: MODEL_NAME,
  };
}

export async function getSummaryJobStatus(params: {
  providerJobId: string;
  config: RunPodConfig;
  fetchFn?: typeof fetch;
}): Promise<SummaryJobStatus> {
  const { providerJobId, config, fetchFn = fetch } = params;
  const statusUrl = `${RUNPOD_API_BASE}/${config.endpointId}/status/${providerJobId}`;

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
    output?: { text?: string };
  };
  const status = mapRunPodStatus(data.status);

  if (status === "completed" && data.output?.text) {
    return {
      status: "completed",
      model: MODEL_NAME,
      summary: data.output.text,
    };
  }

  if (status === "failed") {
    return {
      status: "failed",
      model: MODEL_NAME,
      error: data.error ?? "RunPod job failed",
    };
  }

  if (status === "completed") {
    return {
      status: "failed",
      model: MODEL_NAME,
      error: "RunPod job completed without summary output",
    };
  }

  return {
    status,
    model: MODEL_NAME,
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
