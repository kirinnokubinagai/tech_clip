import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import OnboardingScreen from "../app/onboarding";

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
}));

const mockSetHasSeenOnboarding = jest.fn().mockResolvedValue(undefined);
const mockHasSeenOnboarding = { current: false };

jest.mock("../src/stores/ui-store", () => ({
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

/**
 * testIDでReactTestInstanceを検索するヘルパー
 */
function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance {
  return root.findByProps({ testID: testId });
}

function queryByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const results = root.findAllByProps({ testID: testId });
  return results.length > 0 ? results[0] : null;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasSeenOnboarding.current = false;
});

describe("OnboardingScreen", () => {
  describe("ページ表示", () => {
    it("最初のページが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Assert
      expect(findByTestId(UNSAFE_root, "onboarding-title")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "page-indicator")).toBeDefined();
    });

    it("スキップボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Assert
      expect(findByTestId(UNSAFE_root, "skip-button")).toBeDefined();
    });

    it("次へボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Assert
      expect(findByTestId(UNSAFE_root, "next-button")).toBeDefined();
    });
  });

  describe("スキップボタン", () => {
    it("スキップボタンを押すとhasSeenOnboardingがtrueになること", () => {
      // Arrange
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "skip-button"));

      // Assert
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true);
    });

    it("スキップボタンを押すとログイン画面に遷移すること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "skip-button"));

      // Assert
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login");
      });
    });
  });

  describe("ページ遷移", () => {
    it("次へボタンを押すとページが進むこと", () => {
      // Arrange
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "next-button"));

      // Assert
      expect(findByTestId(UNSAFE_root, "onboarding-title")).toBeDefined();
    });

    it("最終ページで始めるボタンが表示されること", () => {
      // Arrange
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Act - 3回次へを押して最終ページへ
      fireEvent.press(findByTestId(UNSAFE_root, "next-button"));
      fireEvent.press(findByTestId(UNSAFE_root, "next-button"));
      fireEvent.press(findByTestId(UNSAFE_root, "next-button"));

      // Assert
      expect(findByTestId(UNSAFE_root, "finish-button")).toBeDefined();
    });

    it("最終ページの始めるボタンを押すとログイン画面に遷移すること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // 最終ページまで進む
      fireEvent.press(findByTestId(UNSAFE_root, "next-button"));
      fireEvent.press(findByTestId(UNSAFE_root, "next-button"));
      fireEvent.press(findByTestId(UNSAFE_root, "next-button"));

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "finish-button"));

      // Assert
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login");
      });
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true);
    });
  });

  describe("hasSeenOnboarding済み", () => {
    it("hasSeenOnboardingがtrueの場合は何も表示されないこと", () => {
      // Arrange
      mockHasSeenOnboarding.current = true;

      // Act
      const { UNSAFE_root } = render(<OnboardingScreen />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "onboarding-title")).toBeNull();
      expect(queryByTestId(UNSAFE_root, "skip-button")).toBeNull();
    });
  });
});
