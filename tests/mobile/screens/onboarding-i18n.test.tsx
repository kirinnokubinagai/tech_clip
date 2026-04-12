/**
 * オンボーディング画面 i18n 回帰テスト
 *
 * オンボーディング画面は現在 useTranslation を使わず日本語がハードコードされている。
 * このテストはその状態を記録し、i18n 対応後に回帰が検知できることを保証する。
 */
import OnboardingScreen from "@mobile-app/onboarding";
import { render } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
}));

const mockSetHasSeenOnboarding = jest.fn().mockResolvedValue(undefined);

jest.mock("@mobile/stores/ui-store", () => ({
  useUIStore: (
    selector: (state: {
      hasSeenOnboarding: boolean;
      setHasSeenOnboarding: typeof mockSetHasSeenOnboarding;
    }) => unknown,
  ) =>
    selector({
      hasSeenOnboarding: false,
      setHasSeenOnboarding: mockSetHasSeenOnboarding,
    }),
}));

describe("OnboardingScreen（i18n 対応状況の記録）", () => {
  describe("現在の状態（ハードコード日本語文字列の存在確認）", () => {
    it("最初のページタイトルが日本語でハードコードされていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByTestId("onboarding-title").props.children).toBe("技術記事をワンタップで保存");
    });

    it("スキップボタンに日本語テキストがハードコードされていること", async () => {
      // Arrange & Act
      const { getByText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("スキップ")).toBeTruthy();
    });

    it("次へボタンに日本語テキストがハードコードされていること", async () => {
      // Arrange & Act
      const { getByText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("次へ")).toBeTruthy();
    });
  });

  describe("i18n 対応後の期待値（現在は失敗する）", () => {
    it.failing("英語ロケール時にスキップボタンが英語で表示されること（i18n 未対応のため現在は失敗）", async () => {
      // Arrange
      // NOTE: jest.mock はファイル先頭にホイストされるため、このブロック内での呼び出しはモジュール解決に影響しない。
      // OnboardingScreen に i18n を実装した後、このテストは別ファイルで書き直す必要がある。
      jest.mock("react-i18next", () => {
        const enTranslations = jest.requireActual(
          "../../../apps/mobile/src/locales/en.json",
        ) as Record<string, unknown>;
        const t = (key: string) => {
          const parts = key.split(".");
          let current: unknown = enTranslations;
          for (const part of parts) {
            if (typeof current !== "object" || current === null) return key;
            current = (current as Record<string, unknown>)[part];
          }
          return typeof current === "string" ? current : key;
        };
        return {
          useTranslation: () => ({ t, i18n: { language: "en", changeLanguage: jest.fn() } }),
          initReactI18next: { type: "3rdParty", init: () => {} },
          Trans: ({ children }: { children: React.ReactNode }) => children,
          I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
        };
      });

      // Act
      const { getByText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("Skip")).toBeTruthy();
    });
  });
});
