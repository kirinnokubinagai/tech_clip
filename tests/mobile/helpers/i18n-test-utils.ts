/**
 * i18n テストユーティリティ
 * 複数テストファイルで共通して使用するロケール切り替えヘルパーを提供する
 */

import * as reactI18nextMock from "react-i18next";

const i18nMock = reactI18nextMock as unknown as {
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
