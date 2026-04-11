/**
 * i18n テストユーティリティ
 * 複数テストファイルで共通して使用するロケール切り替えヘルパーを提供する
 */

const i18nMock = require("react-i18next") as {
  __setMockLocale: (locale: "ja" | "en") => void;
};

/**
 * テスト用ロケールを設定する
 *
 * @param locale - 設定するロケール（"ja" | "en"）
 */
export function setMockLocale(locale: "ja" | "en"): void {
  i18nMock.__setMockLocale(locale);
}
