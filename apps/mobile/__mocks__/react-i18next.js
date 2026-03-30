/**
 * react-i18next テスト環境モック
 * useTranslation フックをシミュレートし、翻訳キーをそのまま返す
 */

const React = require("react");

/** 翻訳関数モック: キーをそのまま返す */
const tFunction = (key, options) => {
  if (options && typeof options === "object") {
    let result = key;
    for (const [k, v] of Object.entries(options)) {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
    return result;
  }
  return key;
};

/** useTranslation フックモック */
const useTranslation = () => ({
  t: tFunction,
  i18n: {
    changeLanguage: jest.fn().mockResolvedValue(undefined),
    language: "ja",
    isInitialized: true,
  },
});

/** Trans コンポーネントモック */
const Trans = ({ i18nKey, children }) => {
  if (children) {
    return React.createElement(React.Fragment, null, children);
  }
  return React.createElement(React.Fragment, null, i18nKey || "");
};

/** initReactI18next モック */
const initReactI18next = {
  type: "3rdParty",
  init: jest.fn(),
};

/** withTranslation HOC モック */
const withTranslation = () => (Component) => {
  const WrappedComponent = (props) =>
    React.createElement(Component, { ...props, t: tFunction, i18n: { changeLanguage: jest.fn() } });
  return WrappedComponent;
};

/** I18nextProvider モック */
const I18nextProvider = ({ children }) =>
  React.createElement(React.Fragment, null, children);

module.exports = {
  useTranslation,
  Trans,
  initReactI18next,
  withTranslation,
  I18nextProvider,
};
