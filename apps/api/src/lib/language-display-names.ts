import { SUPPORTED_LANGUAGES } from "../validators/ai";

/**
 * 言語コードの表示名マッピング（SSOT）
 *
 * summary.ts / translator.ts の両サービスで共有する。
 */
export const LANGUAGE_DISPLAY_NAMES: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
  en: "English",
  ja: "Japanese",
  zh: "Chinese",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  ko: "Korean",
};
