import { LANGUAGE_DISPLAY_NAMES } from "../lib/language-display-names";
import { DEFAULT_GEMMA_MODEL_TAG, WORKERS_AI_GEMMA_MODEL_ID } from "../lib/ai-model";
import { createLogger } from "../lib/logger";
import { isWorkersAiTextResponse } from "../lib/workers-ai";
import type { SUPPORTED_LANGUAGES } from "../validators/ai";

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
  language: (typeof SUPPORTED_LANGUAGES)[number];
  /** DB 保存用モデルタグ override（省略時は DEFAULT_GEMMA_MODEL_TAG を使用） */
  modelTag?: string;
};

/** 入力コンテンツ最大文字数（約6000トークン相当） */
const MAX_CONTENT_LENGTH = 24000;

/** 要約生成時の最大トークン数 */
const SUMMARY_MAX_TOKENS = 1024;

/** 要約生成時の temperature */
const SUMMARY_TEMPERATURE = 0.3;

/** HTML エンティティのデコードマップ */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * 記事コンテンツの HTML をサニタイズしてプレーンテキストに変換する
 *
 * プロンプトインジェクション対策として script/style ブロックを除去し、
 * HTML タグを取り除いてプレーンテキスト化する。
 *
 * @param content - 元のコンテンツ文字列
 * @returns サニタイズ済みのプレーンテキスト（MAX_CONTENT_LENGTH 以内）
 */
export function sanitizeArticleContent(content: string): string {
  const withoutScript = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  const withoutStyle = withoutScript.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    " ",
  );
  const withoutTags = withoutStyle.replace(/<[^>]+>/g, " ");
  const decoded = withoutTags.replace(
    /&amp;|&lt;|&gt;|&quot;|&#039;|&apos;|&nbsp;/g,
    (match) => HTML_ENTITIES[match] ?? match,
  );
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_CONTENT_LENGTH ? collapsed.slice(0, MAX_CONTENT_LENGTH) : collapsed;
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
  const sanitized = sanitizeArticleContent(content);
  const languageName = LANGUAGE_DISPLAY_NAMES[language];

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
    const result = await ai.run(WORKERS_AI_GEMMA_MODEL_ID, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: sanitized },
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
    const logger = createLogger("summary-service");
    logger.error("Workers AI 要約生成エラー", {
      language: params.language,
      modelTag: params.modelTag,
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
    throw new Error("要約の生成に失敗しました", { cause: error });
  }
}
