import type { Language, SummaryLanguage } from "@/stores/settings-store";

/**
 * UI 言語コード（地域コード含む）→ API 要約・翻訳言語コード のマッピング
 *
 * API が zh-CN/zh-TW を区別してサポートするため、それぞれ個別にマッピングする
 */
export const UI_TO_API_LANGUAGE: Record<Language, SummaryLanguage> = {
  ja: "ja",
  en: "en",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  ko: "ko",
};
