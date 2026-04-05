import type { Language } from "@/stores/settings-store";

/** 要約でサポートされる言語コード */
type SummaryLanguageCode = "ja" | "en" | "zh" | "ko";

/** 翻訳でサポートされる言語コード */
type TranslationLanguageCode = "en" | "ja";

/**
 * localeコードから要約APIの言語コードへのマッピング
 *
 * 現時点では恒等写像だが、将来 zh / ko など Language と
 * SummaryLanguageCode が非対称になる際に変更箇所を1箇所に集約するために維持する
 */
const SUMMARY_LANGUAGE_CODE_MAP: Record<Language, SummaryLanguageCode> = {
  ja: "ja",
  en: "en",
};

/**
 * localeコードから翻訳APIの言語コードへのマッピング
 *
 * 現時点では恒等写像だが、将来 Language と TranslationLanguageCode が
 * 非対称になる際に変更箇所を1箇所に集約するために維持する
 */
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
