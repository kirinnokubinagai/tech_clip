import { z } from "zod";

/** サポートされる言語 */
export const SUPPORTED_LANGUAGES = ["en", "ja", "zh", "zh-CN", "zh-TW", "ko"] as const;

/**
 * 翻訳生成リクエストのZodスキーマ
 */
export const GenerateTranslationSchema = z.object({
  targetLanguage: z.enum(SUPPORTED_LANGUAGES, {
    error: `targetLanguageは${SUPPORTED_LANGUAGES.join("、")}で指定してください`,
  }),
});

/**
 * 要約生成リクエストのZodスキーマ
 */
export const GenerateSummarySchema = z.object({
  language: z
    .enum(SUPPORTED_LANGUAGES, {
      error: `languageは${SUPPORTED_LANGUAGES.join("、")}で指定してください`,
    })
    .optional(),
});

/** GenerateTranslationSchemaの型 */
export type GenerateTranslationInput = z.infer<typeof GenerateTranslationSchema>;

/** GenerateSummarySchemaの型 */
export type GenerateSummaryInput = z.infer<typeof GenerateSummarySchema>;

/**
 * 値がサポート言語コードかどうかを判定する型ガード
 *
 * @param v - 検証対象の文字列
 * @returns SUPPORTED_LANGUAGES のいずれかかどうか
 */
export function isSupportedLanguage(v: string): v is (typeof SUPPORTED_LANGUAGES)[number] {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}
