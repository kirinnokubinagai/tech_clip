import { DEFAULT_GEMMA_MODEL_TAG, WORKERS_AI_GEMMA_MODEL_ID } from "../lib/ai-model";

/** 要約生成結果 */
export type SummaryResult = {
  summary: string;
  model: string;
};

/** summarizeArticle 関数のパラメータ */
export type SummarizeArticleParams = {
  /** Cloudflare Workers AI バインディング */
  ai: Ai;
  content: string;
  language: string;
  /** DB 保存用モデルタグ override（省略時は DEFAULT_GEMMA_MODEL_TAG を使用） */
  modelTag?: string;
};

/** 言語名マッピング */
const LANGUAGE_NAMES: Record<string, string> = {
  ja: "Japanese",
  en: "English",
  zh: "Chinese",
  ko: "Korean",
};

/** 入力コンテンツ最大文字数（約6000トークン相当） */
const MAX_CONTENT_LENGTH = 24000;

/** 要約生成時の最大トークン数 */
const SUMMARY_MAX_TOKENS = 1024;

/** 要約生成時の temperature */
const SUMMARY_TEMPERATURE = 0.3;

/**
 * Workers AI レスポンスの型ガード
 *
 * @param value - 検証対象の値
 * @returns response フィールドが string かどうか
 */
function isWorkersAiTextResponse(value: unknown): value is { response: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.response === "string";
}

/**
 * 記事コンテンツを Workers AI (Gemma) で要約する
 *
 * @param params - 要約パラメータ
 * @returns 要約テキストとモデルタグ
 * @throws 要約の生成に失敗しました - Workers AI 呼び出しエラー時
 */
export async function summarizeArticle(params: SummarizeArticleParams): Promise<SummaryResult> {
  const { ai, content, language, modelTag } = params;
  const resolvedModelTag = modelTag ?? DEFAULT_GEMMA_MODEL_TAG;
  const truncated =
    content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) : content;
  const languageName = LANGUAGE_NAMES[language] ?? "Japanese";

  const systemPrompt = `Summarize the following article in ${languageName}. Provide:
1. A concise summary (2-3 sentences)
2. 3-5 key points as bullet points

Output format:
Summary:
[2-3 sentence summary here]

Key Points:
- [key point 1]
- [key point 2]
- [key point 3]`;

  try {
    const result = await (
      ai as unknown as { run: (model: string, inputs: unknown) => Promise<unknown> }
    ).run(WORKERS_AI_GEMMA_MODEL_ID, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncated },
      ],
      max_tokens: SUMMARY_MAX_TOKENS,
      temperature: SUMMARY_TEMPERATURE,
    });

    if (!isWorkersAiTextResponse(result)) {
      throw new Error("Workers AI から有効な要約レスポンスを取得できませんでした");
    }

    return {
      summary: result.response,
      model: resolvedModelTag,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "要約の生成に失敗しました") {
      throw error;
    }
    throw new Error("要約の生成に失敗しました");
  }
}
