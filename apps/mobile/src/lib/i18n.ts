import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import ja from "../locales/ja.json";

/** サポートする言語一覧 */
const SUPPORTED_LANGUAGES = ["ja", "en"] as const;

/** デフォルト言語 */
const DEFAULT_LANGUAGE = "ja";

/**
 * デバイスのロケールからサポート言語を解決する
 *
 * @returns サポートされている言語コード
 */
function resolveDeviceLanguage(): string {
  const locales = getLocales();
  if (locales.length === 0) {
    return DEFAULT_LANGUAGE;
  }

  const deviceLang = locales[0]?.languageCode;
  if (!deviceLang) {
    return DEFAULT_LANGUAGE;
  }

  const isSupported = SUPPORTED_LANGUAGES.includes(
    deviceLang as (typeof SUPPORTED_LANGUAGES)[number],
  );
  if (!isSupported) {
    return DEFAULT_LANGUAGE;
  }

  return deviceLang;
}

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: resolveDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
