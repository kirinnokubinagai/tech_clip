import type { Language } from "@/stores/settings-store";

/** 要約でサポートされる言語コード */
type SummaryLanguageCode = "ja" | "en" | "zh" | "ko";

/** 翻訳でサポートされる言語コード */
type TranslationLanguageCode = "en" | "ja";

/** localeコードから要約APIの言語コードへのマッピング */
const SUMMARY_LANGUAGE_CODE_MAP: Record<Language, SummaryLanguageCode> = {
  ja: "ja",
  en: "en",
};

/** localeコードから翻訳APIの言語コードへのマッピング */
const TRANSLATION_LANGUAGE_CODE_MAP: Record<Language, TranslationLanguageCode> = {
  ja: "ja",
  en: "en",
};

/**
 * localeコードを要約API用の言語コードに変換する
 *
 * @param language - localeコード（"ja" | "en"）
 * @returns 要約APIの言語コード
 */
export function toSummaryLanguageCode(language: Language): SummaryLanguageCode {
  return SUMMARY_LANGUAGE_CODE_MAP[language];
}

/**
 * localeコードを翻訳API用の言語コードに変換する
 *
 * @param language - localeコード（"ja" | "en"）
 * @returns 翻訳APIの言語コード
 */
export function toTranslationLanguageCode(language: Language): TranslationLanguageCode {
  return TRANSLATION_LANGUAGE_CODE_MAP[language];
}
