import OnboardingScreen from "@mobile-app/onboarding";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { setMockLocale } from "../helpers/i18n-test-utils";

/** テスト用ソース数（sources.ts の SUPPORTED_SOURCE_COUNT と一致させる） */
const MOCK_SOURCE_COUNT = 19;

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
const mockHasSeenOnboarding = { current: false };

jest.mock("@mobile/stores/ui-store", () => ({
  useUIStore: (
    selector: (state: {
      hasSeenOnboarding: boolean;
      setHasSeenOnboarding: typeof mockSetHasSeenOnboarding;
    }) => unknown,
  ) =>
    selector({
      hasSeenOnboarding: mockHasSeenOnboarding.current,
      setHasSeenOnboarding: mockSetHasSeenOnboarding,
    }),
}));

const { router: mockRouter } = jest.requireMock("expo-router") as {
  router: { replace: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHasSeenOnboarding.current = false;
  setMockLocale("ja");
});

describe("OnboardingScreen", () => {
  describe("ページ表示", () => {
    it("最初のページが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByTestId("onboarding-title")).not.toBeNull();
      expect(getByTestId("page-indicator")).not.toBeNull();
    });

    it("スキップボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByTestId("skip-button")).not.toBeNull();
    });

    it("次へボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByTestId("next-button")).not.toBeNull();
    });
  });

  describe("スキップボタン", () => {
    it("スキップボタンを押すとhasSeenOnboardingがtrueになること", async () => {
      // Arrange
      const { getByTestId } = await render(<OnboardingScreen />);

      // Act
      await fireEvent.press(getByTestId("skip-button"));

      // Assert
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true);
    });

    it("スキップボタンを押すとログイン画面に遷移すること", async () => {
      // Arrange
      const { getByTestId } = await render(<OnboardingScreen />);

      // Act
      await fireEvent.press(getByTestId("skip-button"));

      // Assert
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login");
      });
    });
  });

  describe("ページ遷移", () => {
    it("次へボタンを押すとページが進むこと", async () => {
      // Arrange
      const { getByTestId } = await render(<OnboardingScreen />);

      // Act
      await fireEvent.press(getByTestId("next-button"));

      // Assert
      expect(getByTestId("onboarding-title")).not.toBeNull();
    });

    it("最終ページで始めるボタンが表示されること", async () => {
      // Arrange
      const { getByTestId } = await render(<OnboardingScreen />);

      // Act - 3回次へを押して最終ページへ
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));

      // Assert
      expect(getByTestId("finish-button")).not.toBeNull();
    });

    it("最終ページの始めるボタンを押すとログイン画面に遷移すること", async () => {
      // Arrange
      const { getByTestId } = await render(<OnboardingScreen />);

      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));

      // Act
      await fireEvent.press(getByTestId("finish-button"));

      // Assert
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login");
      });
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true);
    });
  });

  describe("i18n", () => {
    it("最初のページの説明文にソース数が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<OnboardingScreen />);

      // Assert
      expect(
        getByText(
          `Zenn、Qiita、dev.toなど${MOCK_SOURCE_COUNT}ソースに対応。気になった記事をすぐ保存できます。`,
        ),
      ).toBeDefined();
    });
  });

  describe("hasSeenOnboarding済み", () => {
    it("hasSeenOnboardingがtrueの場合は何も表示されないこと", async () => {
      // Arrange
      mockHasSeenOnboarding.current = true;

      // Act
      const { queryByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(queryByTestId("onboarding-title")).toBeNull();
      expect(queryByTestId("skip-button")).toBeNull();
    });
  });

  describe("多言語対応", () => {
    it("日本語ロケールで日本語タイトルとボタン文言が表示されること", async () => {
      // Arrange
      setMockLocale("ja");

      // Act
      const { getByText, getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("技術記事をワンタップで保存")).not.toBeNull();
      expect(getByTestId("skip-button")).not.toBeNull();
      expect(getByText("スキップ")).not.toBeNull();
      expect(getByText("次へ")).not.toBeNull();
    });

    it("英語ロケールで英語タイトルとボタン文言が表示されること", async () => {
      // Arrange
      setMockLocale("en");

      // Act
      const { getByText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("Save Tech Articles with One Tap")).not.toBeNull();
      expect(getByText("Skip")).not.toBeNull();
      expect(getByText("Next")).not.toBeNull();
    });

    it("英語ロケールの最終ページでGet Startedボタンが表示されること", async () => {
      // Arrange
      setMockLocale("en");
      const { getByTestId, getByText } = await render(<OnboardingScreen />);

      // Act - 3回次へを押して最終ページへ
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));

      // Assert
      expect(getByText("Get Started")).not.toBeNull();
    });
  });

  describe("a11y 翻訳キー", () => {
    it("日本語ロケールでスキップボタンの accessibilityLabel が正しく翻訳されること", async () => {
      // Arrange
      setMockLocale("ja");

      // Act
      const { getByLabelText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByLabelText("スキップ")).not.toBeNull();
    });

    it("日本語ロケールで次へボタンの accessibilityLabel が正しく翻訳されること", async () => {
      // Arrange
      setMockLocale("ja");

      // Act
      const { getByTestId, getByLabelText } = await render(<OnboardingScreen />);

      // Assert: 最初のページ（currentIndex=0）なので page=2 になる
      expect(getByLabelText("次へ")).not.toBeNull();
      expect(getByTestId("next-button")).not.toBeNull();
    });

    it("英語ロケールでスキップボタンの accessibilityLabel が正しく翻訳されること", async () => {
      // Arrange
      setMockLocale("en");

      // Act
      const { getByLabelText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByLabelText("Skip")).not.toBeNull();
    });

    it("英語ロケールで次へボタンの accessibilityLabel が正しく翻訳されること", async () => {
      // Arrange
      setMockLocale("en");

      // Act
      const { getByLabelText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByLabelText("Next")).not.toBeNull();
    });
  });
});
