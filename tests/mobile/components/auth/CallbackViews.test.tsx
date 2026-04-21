import { CallbackErrorView, CallbackLoadingView } from "@mobile/components/auth/CallbackViews";
import { fireEvent, render } from "@testing-library/react-native";

describe("CallbackErrorView", () => {
  const DEFAULT_PROPS = {
    message: "認証に失敗しました",
    errorTestId: "error-text",
    backButtonTestId: "back-button",
    onBackToLogin: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("レンダリング", () => {
    it("エラーメッセージが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      // Assert
      expect(getByText("認証に失敗しました")).toBeTruthy();
    });

    it("errorTestIdが設定されていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      // Assert
      expect(getByTestId("error-text")).toBeTruthy();
    });

    it("backButtonTestIdが設定されていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      // Assert
      expect(getByTestId("back-button")).toBeTruthy();
    });

    it("エラーテキストにaccessibilityRole='alert'が設定されていること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);
      const json = JSON.stringify(toJSON());

      // Assert
      expect(json).toContain('"accessibilityRole":"alert"');
    });
  });

  describe("インタラクション", () => {
    it("戻るボタンを押すとonBackToLoginが呼ばれること", async () => {
      // Arrange
      const onBackToLogin = jest.fn();
      const { getByTestId } = await render(
        <CallbackErrorView {...DEFAULT_PROPS} onBackToLogin={onBackToLogin} />,
      );

      // Act
      fireEvent.press(getByTestId("back-button"));

      // Assert
      expect(onBackToLogin).toHaveBeenCalledTimes(1);
    });
  });
});

describe("CallbackLoadingView", () => {
  const DEFAULT_PROPS = {
    loadingTestId: "loading-indicator",
    message: "認証処理中...",
  };

  describe("レンダリング", () => {
    it("メッセージテキストが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<CallbackLoadingView {...DEFAULT_PROPS} />);

      // Assert
      expect(getByText("認証処理中...")).toBeTruthy();
    });

    it("ActivityIndicatorがloadingTestIdで表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<CallbackLoadingView {...DEFAULT_PROPS} />);

      // Assert
      expect(getByTestId("loading-indicator")).toBeTruthy();
    });

    it("ActivityIndicatorのaccessibilityLabelにメッセージが設定されていること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<CallbackLoadingView {...DEFAULT_PROPS} />);
      const json = JSON.stringify(toJSON());

      // Assert
      expect(json).toContain('"accessibilityLabel":"認証処理中..."');
    });
  });
});
