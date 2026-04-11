import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";

/** サポートする言語一覧 */
const SUPPORTED_LANGUAGES = ["ja", "en", "zh-CN", "zh-TW", "ko"] as const;

/** サポートする言語コードの型 */
type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** デフォルト言語 */
const DEFAULT_LANGUAGE: Language = "ja";

/**
 * デバイスのロケールからサポート言語を解決する
 *
 * languageTag を優先使用し zh-Hans-* → zh-CN、zh-Hant-* → zh-TW のマッピングを行う
 *
 * @returns サポートされている言語コード
 */
function resolveDeviceLanguage(): Language {
  const locales = getLocales();
  if (locales.length === 0) {
    return DEFAULT_LANGUAGE;
  }

  const locale = locales[0];
  if (!locale) {
    return DEFAULT_LANGUAGE;
  }

  const tag = locale.languageTag ?? "";
  const code = locale.languageCode ?? "";

  if (tag.startsWith("zh-Hans") || tag === "zh-CN" || code === "zh-Hans") {
    return "zh-CN" as const;
  }
  if (tag.startsWith("zh-Hant") || tag === "zh-TW" || tag === "zh-HK" || code === "zh-Hant") {
    return "zh-TW" as const;
  }

  const isSupported = SUPPORTED_LANGUAGES.includes(code as Language);
  if (!isSupported) {
    return DEFAULT_LANGUAGE;
  }

  return code as Language;
}

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    "zh-TW": { translation: zhTW },
    ko: { translation: ko },
  },
  lng: resolveDeviceLanguage(),
  fallbackLng: ["en", "ja"],
  interpolation: {
    // React Native では XSS リスクが低いため false に設定
    escapeValue: false,
  },
});

export default i18n;
