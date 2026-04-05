import type { Language } from "@/stores/settings-store";

/** 要約でサポートされる言語コード */
type SummaryLanguageCode = "ja" | "en" | "zh" | "ko";

/** 翻訳でサポートされる言語コード */
type TranslationLanguageCode = "en" | "ja";

/**
 * 言語コードの正規化マッピング
 * 現在は恒等写像だが、将来的に非対称マッピング（zh→zh-CN 等）が必要になった際の拡張ポイントとして残している
 */
const SUMMARY_LANGUAGE_CODE_MAP: Record<Language, SummaryLanguageCode> = {
  ja: "ja",
  en: "en",
};

/**
 * 言語コードの正規化マッピング
 * 現在は恒等写像だが、将来的に非対称マッピング（zh→zh-CN 等）が必要になった際の拡張ポイントとして残している
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
