import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";
import {
  DEFAULT_UI_LANGUAGE,
  resolveChineseVariant,
  SUPPORTED_UI_LANGUAGES,
  type UiLanguage,
} from "./language-code";

/**
 * デバイスのロケールからサポート言語を解決する
 *
 * languageTag を優先使用し zh-Hans-* → zh-CN、zh-Hant-* → zh-TW のマッピングを行う
 *
 * @returns サポートされている言語コード
 */
function resolveDeviceLanguage(): UiLanguage {
  // E2E tests are written in Japanese; force ja regardless of emulator locale
  if (process.env.EXPO_PUBLIC_E2E_MODE === "1") {
    return DEFAULT_UI_LANGUAGE;
  }
  const locales = getLocales();
  if (locales.length === 0) {
    return DEFAULT_UI_LANGUAGE;
  }

  const locale = locales[0];
  if (!locale) {
    return DEFAULT_UI_LANGUAGE;
  }

  const tag = locale.languageTag ?? "";
  const code = locale.languageCode ?? "";

  const chineseVariant = resolveChineseVariant(tag, code);
  if (chineseVariant !== null) {
    return chineseVariant;
  }

  const isSupported = SUPPORTED_UI_LANGUAGES.includes(code as UiLanguage);
  if (!isSupported) {
    return DEFAULT_UI_LANGUAGE;
  }

  return code as UiLanguage;
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
