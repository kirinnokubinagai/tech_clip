/**
 * Workers AI レスポンスの型ガード + テキスト抽出ヘルパー
 *
 * Cloudflare Workers AI モデルは以下 2 つの形式を返す:
 * - 旧形式 (llama 系など): `{ response: string }`
 * - 新形式 (gemma-4 / OpenAI 互換): `{ choices: [{ message: { content: string } }] }`
 *
 * いずれの場合も extractTextResponse() で文字列を取り出せる。
 */

type LegacyResponse = { response: string };
type ChatCompletionResponse = {
  choices: Array<{ message: { content: string } }>;
};

/**
 * テキスト応答を持つレスポンスか判定する
 */
export function isWorkersAiTextResponse(
  value: unknown,
): value is LegacyResponse | ChatCompletionResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.response === "string") {
    return true;
  }
  if (Array.isArray(v.choices) && v.choices.length > 0) {
    const first = v.choices[0] as Record<string, unknown> | undefined;
    const msg = first?.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === "string") {
      return true;
    }
  }
  return false;
}

/**
 * テキスト応答から文字列を取り出す
 */
export function extractTextResponse(value: LegacyResponse | ChatCompletionResponse): string {
  if ("response" in value && typeof value.response === "string") {
    return value.response;
  }
  if ("choices" in value && value.choices.length > 0) {
    return value.choices[0].message.content;
  }
  throw new Error("Workers AI のレスポンス形式が不明です");
}
