import type { Language } from "@/stores/settings-store";

/** 要約でサポートされる言語コード */
type SummaryLanguageCode = "ja" | "en" | "zh" | "ko";

/** 翻訳でサポートされる言語コード */
type TranslationLanguageCode = "en" | "ja";

/** 言語ロケールコードから要約APIの言語コードへのマッピング */
const SUMMARY_LANGUAGE_CODE_MAP: Record<Language, SummaryLanguageCode> = {
  ja: "ja",
  en: "en",
};

/** 言語ロケールコードから翻訳APIの言語コードへのマッピング */
const TRANSLATION_LANGUAGE_CODE_MAP: Record<Language, TranslationLanguageCode> = {
  ja: "ja",
  en: "en",
};

/**
 * 言語表示名を要約API用の言語コードに変換する
 *
 * @param language - 言語ロケールコード（"ja" | "en"）
 * @returns 要約APIの言語コード
 */
export function toSummaryLanguageCode(language: Language): SummaryLanguageCode {
  return SUMMARY_LANGUAGE_CODE_MAP[language];
}

/**
 * 言語表示名を翻訳API用の言語コードに変換する
 *
 * @param language - 言語ロケールコード（"ja" | "en"）
 * @returns 翻訳APIの言語コード
 */
export function toTranslationLanguageCode(language: Language): TranslationLanguageCode {
  return TRANSLATION_LANGUAGE_CODE_MAP[language];
}
