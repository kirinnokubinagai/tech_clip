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

/**
 * 要約プロンプトを生成する
 *
 * @param content - 記事本文
 * @param language - 出力言語
 * @returns プロンプト文字列
 */
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

/**
 * RunPod API経由でQwen3.5 9Bに要約を依頼する
 *
 * @param params - コンテンツ、言語、RunPod設定、fetch関数
 * @returns 要約結果（summary + model名）
 * @throws Error - API呼び出しに失敗した場合
 */
export async function summarizeArticle(params: SummarizeArticleParams): Promise<SummaryResult> {
  const { content, language, config, fetchFn = fetch } = params;

  const prompt = buildPrompt(content, language);
  const runUrl = `https://api.runpod.ai/v2/${config.endpointId}/run`;

  try {
    const runResponse = await fetchFn(runUrl, {
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

    if (!runResponse.ok) {
      throw new Error(`RunPod API error: ${runResponse.status}`);
    }

    const runData = (await runResponse.json()) as { id: string; status: string };
    const jobId = runData.id;

    const statusUrl = `https://api.runpod.ai/v2/${config.endpointId}/status/${jobId}`;

    let attempts = 0;
    while (attempts < MAX_POLLING_ATTEMPTS) {
      const statusResponse = await fetchFn(statusUrl, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`RunPod status error: ${statusResponse.status}`);
      }

      const statusData = (await statusResponse.json()) as {
        status: string;
        output?: { text: string };
      };

      if (statusData.status === "COMPLETED" && statusData.output) {
        return {
          summary: statusData.output.text,
          model: MODEL_NAME,
        };
      }

      if (statusData.status === "FAILED") {
        throw new Error("RunPod job failed");
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
