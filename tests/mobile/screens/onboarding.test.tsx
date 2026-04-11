import OnboardingScreen from "@mobile-app/onboarding";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const { __setMockLocale } = require("react-i18next") as {
  __setMockLocale: (locale: "ja" | "en") => void;
};

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
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
  __setMockLocale("ja");
});

describe("OnboardingScreen", () => {
  describe("ページ表示", () => {
    it("最初のページが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByTestId("onboarding-title")).toBeDefined();
      expect(getByTestId("page-indicator")).toBeDefined();
    });

    it("スキップボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByTestId("skip-button")).toBeDefined();
    });

    it("次へボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByTestId("next-button")).toBeDefined();
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
      expect(getByTestId("onboarding-title")).toBeDefined();
    });

    it("最終ページで始めるボタンが表示されること", async () => {
      // Arrange
      const { getByTestId } = await render(<OnboardingScreen />);

      // Act - 3回次へを押して最終ページへ
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));

      // Assert
      expect(getByTestId("finish-button")).toBeDefined();
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
      __setMockLocale("ja");

      // Act
      const { getByText, getByTestId } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("技術記事をワンタップで保存")).toBeTruthy();
      expect(getByTestId("skip-button")).toBeTruthy();
      expect(getByText("スキップ")).toBeTruthy();
      expect(getByText("次へ")).toBeTruthy();
    });

    it("英語ロケールで英語タイトルとボタン文言が表示されること", async () => {
      // Arrange
      __setMockLocale("en");

      // Act
      const { getByText } = await render(<OnboardingScreen />);

      // Assert
      expect(getByText("Save Tech Articles with One Tap")).toBeTruthy();
      expect(getByText("Skip")).toBeTruthy();
      expect(getByText("Next")).toBeTruthy();
    });

    it("英語ロケールの最終ページでGet Startedボタンが表示されること", async () => {
      // Arrange
      __setMockLocale("en");
      const { getByTestId, getByText } = await render(<OnboardingScreen />);

      // Act - 3回次へを押して最終ページへ
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));
      await fireEvent.press(getByTestId("next-button"));

      // Assert
      expect(getByText("Get Started")).toBeTruthy();
    });
  });
});
