/**
 * react-i18next のモック
 * ja.json から実際の翻訳を解決し、テストで日本語文字列を検証できるようにする
 */
const actualReact = jest.requireActual("react");
const jaTranslations = jest.requireActual("../src/locales/ja.json");

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
  const value = resolveKey(jaTranslations, key);
  if (opts && typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      opts[k] !== undefined ? String(opts[k]) : `{{${k}}}`,
    );
  }
  return value;
}

const i18nStub = { language: "ja", changeLanguage: jest.fn() };

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
};
