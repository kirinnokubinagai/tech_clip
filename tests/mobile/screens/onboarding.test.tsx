import OnboardingScreen from "@mobile-app/onboarding";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

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
});
