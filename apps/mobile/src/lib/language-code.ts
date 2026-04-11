/** サポートするUI言語コード一覧 */
export const SUPPORTED_UI_LANGUAGES = ["ja", "en", "zh-CN", "zh-TW", "ko"] as const;

/** UI言語コードの型 */
export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

/** サポートする要約言語コード一覧 */
export const SUPPORTED_SUMMARY_LANGUAGES = ["ja", "en", "zh", "zh-CN", "zh-TW", "ko"] as const;

/** 要約言語コードの型 */
export type SummaryLang = (typeof SUPPORTED_SUMMARY_LANGUAGES)[number];

/**
 * UI 言語コード（地域コード含む）→ API 要約・翻訳言語コード のマッピング
 *
 * API が zh-CN/zh-TW を区別してサポートするため、それぞれ個別にマッピングする
 */
export const UI_TO_API_LANGUAGE: Record<UiLanguage, SummaryLang> = {
  ja: "ja",
  en: "en",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  ko: "ko",
};

/**
 * デバイスロケール情報から中国語バリアントを解決する
 *
 * languageTag を優先し、zh-Hans-* → zh-CN、zh-Hant-* → zh-TW のマッピングを行う
 *
 * @param languageTag - BCP 47 言語タグ（例: "zh-Hans-CN"）
 * @param languageCode - 言語コード（例: "zh-Hans"）
 * @returns zh-CN / zh-TW のいずれか、または null（中国語でない場合）
 */
export function resolveChineseVariant(
  languageTag: string,
  languageCode: string,
): "zh-CN" | "zh-TW" | null {
  if (languageTag.startsWith("zh-Hans") || languageTag === "zh-CN" || languageCode === "zh-Hans") {
    return "zh-CN";
  }
  if (
    languageTag.startsWith("zh-Hant") ||
    languageTag === "zh-TW" ||
    languageTag === "zh-HK" ||
    languageCode === "zh-Hant"
  ) {
    return "zh-TW";
  }
  return null;
}
