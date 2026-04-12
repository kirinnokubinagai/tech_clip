/**
 * 英語ロケール用 react-i18next モックファクトリ
 *
 * en.json の実際の翻訳キーを解決する jest.mock ファクトリ関数をエクスポートする。
 * 各テストファイルで `jest.mock("react-i18next", i18nEnMockFactory)` として使用する。
 *
 * @example
 * ```ts
 * import { i18nEnMockFactory } from "../helpers/i18n-en-mock";
 * jest.mock("react-i18next", i18nEnMockFactory);
 * ```
 */

/** en.json 翻訳オブジェクト内のドット区切りキーを解決する */
function resolveKey(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return key;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current !== undefined && current !== null ? String(current) : key;
}

/**
 * en.json から実際の英語翻訳を解決するモックファクトリ
 *
 * jest.mock の第2引数として渡す。
 */
export function i18nEnMockFactory() {
  const actualReact = jest.requireActual("react");
  const enTranslations = jest.requireActual("../../../apps/mobile/src/locales/en.json") as Record<
    string,
    unknown
  >;

  function t(key: string, opts?: Record<string, unknown>): string {
    const value = resolveKey(enTranslations, key);
    if (opts && typeof value === "string") {
      return value.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) =>
        opts[k] !== undefined ? String(opts[k]) : `{{${k}}}`,
      );
    }
    return value;
  }

  const i18nStub = { language: "en", changeLanguage: jest.fn() };

  return {
    useTranslation: () => ({ t, i18n: i18nStub }),
    withTranslation: () => (Component: React.ComponentType) => {
      const Wrapped = (props: Record<string, unknown>) =>
        actualReact.createElement(Component, { ...props, t, i18n: i18nStub });
      Wrapped.displayName = `withTranslation(${(Component as { displayName?: string; name?: string }).displayName || (Component as { name?: string }).name || "Component"})`;
      return Wrapped;
    },
    initReactI18next: { type: "3rdParty", init: () => {} },
    Trans: ({ children }: { children: React.ReactNode }) => children,
    I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  };
}
