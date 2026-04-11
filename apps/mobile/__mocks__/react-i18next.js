/**
 * react-i18next のモック
 * ja.json / en.json から実際の翻訳を解決し、テストで locale 文字列を検証できるようにする。
 * デフォルトは ja。setMockLocale("en") で英語に切り替えられる。
 */
const actualReact = jest.requireActual("react");
const jaTranslations = jest.requireActual("../src/locales/ja.json");
const enTranslations = jest.requireActual("../src/locales/en.json");

/** 現在のモックロケール */
let currentLocale = "ja";

/** ロケール別の翻訳辞書 */
const translations = {
  ja: jaTranslations,
  en: enTranslations,
};

function resolveKey(obj, key) {
  const parts = key.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return key;
    }
    current = current[part];
  }
  return current !== undefined && current !== null ? String(current) : key;
}

function t(key, opts) {
  const dict = translations[currentLocale] ?? jaTranslations;
  const value = resolveKey(dict, key);
  if (opts && typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      opts[k] !== undefined ? String(opts[k]) : `{{${k}}}`,
    );
  }
  return value;
}

const i18nStub = {
  get language() {
    return currentLocale;
  },
  changeLanguage: jest.fn((lng) => {
    currentLocale = lng;
    return Promise.resolve();
  }),
};

/**
 * テストでロケールを切り替えるためのヘルパー
 * @param {"ja"|"en"} locale
 */
function setMockLocale(locale) {
  currentLocale = locale;
}

module.exports = {
  useTranslation: () => ({ t, i18n: i18nStub }),
  withTranslation: () => (Component) => {
    const Wrapped = (props) =>
      actualReact.createElement(Component, { ...props, t, i18n: i18nStub });
    Wrapped.displayName = `withTranslation(${Component.displayName || Component.name || "Component"})`;
    return Wrapped;
  },
  initReactI18next: { type: "3rdParty", init: () => {} },
  Trans: ({ children }) => children,
  I18nextProvider: ({ children }) => children,
  __setMockLocale: setMockLocale,
};
