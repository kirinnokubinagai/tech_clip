import { z } from "zod";

/** サポートされる言語 */
export const SUPPORTED_LANGUAGES = ["en", "ja", "zh", "zh-CN", "zh-TW", "ko"] as const;

/**
 * 翻訳生成リクエストのZodスキーマ
 */
export const GenerateTranslationSchema = z.object({
  targetLanguage: z.enum(SUPPORTED_LANGUAGES, {
    error: "targetLanguageはen、ja、zh、zh-CN、zh-TW、koで指定してください",
  }),
});

/**
 * 要約生成リクエストのZodスキーマ
 */
export const GenerateSummarySchema = z.object({
  language: z
    .enum(SUPPORTED_LANGUAGES, {
      error: "languageはen、ja、zh、zh-CN、zh-TW、koで指定してください",
    })
    .optional(),
});

/** GenerateTranslationSchemaの型 */
export type GenerateTranslationInput = z.infer<typeof GenerateTranslationSchema>;

/** GenerateSummarySchemaの型 */
export type GenerateSummaryInput = z.infer<typeof GenerateSummarySchema>;
