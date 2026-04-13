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

jest.mock("@/lib/constants", () => ({
  LIGHT_COLORS: { neutral: "#44403c" },
  SUPPORTED_SOURCE_COUNT: 19,
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

      // Act
      const { getByText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("Skip")).toBeTruthy();
    });
  });
});
