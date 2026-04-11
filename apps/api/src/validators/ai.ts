import { z } from "zod";

/** 翻訳でサポートされる言語 */
const TRANSLATION_SUPPORTED_LANGUAGES = ["en", "ja"] as const;

/** 要約でサポートされる言語 */
const SUMMARY_SUPPORTED_LANGUAGES = ["ja", "en", "zh", "ko"] as const;

/**
 * 翻訳生成リクエストのZodスキーマ
 */
export const GenerateTranslationSchema = z.object({
  targetLanguage: z.enum(TRANSLATION_SUPPORTED_LANGUAGES, {
    error: "targetLanguageはenまたはjaで指定してください",
  }),
});

/**
 * 要約生成リクエストのZodスキーマ
 */
export const GenerateSummarySchema = z.object({
  language: z
    .enum(SUMMARY_SUPPORTED_LANGUAGES, {
      error: "languageはja, en, zh, koのいずれかで指定してください",
    })
    .optional(),
});

/** GenerateTranslationSchemaの型 */
export type GenerateTranslationInput = z.infer<typeof GenerateTranslationSchema>;

/** GenerateSummarySchemaの型 */
export type GenerateSummaryInput = z.infer<typeof GenerateSummarySchema>;
