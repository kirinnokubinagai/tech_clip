import type { Language, SummaryLanguage } from "@/stores/settings-store";

/**
 * UI 言語コード（地域コード含む）→ API 要約・翻訳言語コード（ISO 639-1）のマッピング
 *
 * UI では zh-CN/zh-TW を区別するが、API（vLLM）は zh のみサポート
 */
export const UI_TO_API_LANGUAGE: Record<Language, SummaryLanguage> = {
  ja: "ja",
  en: "en",
  "zh-CN": "zh",
  "zh-TW": "zh",
  ko: "ko",
};
