import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ShareIntentScreen from "../app/share-intent";

/** expo-share-intentのモック */
const mockUseShareIntent = jest.fn();

jest.mock("expo-share-intent", () => ({
  useShareIntent: (...args: unknown[]) => mockUseShareIntent(...args),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

/** モックされたrouterの参照 */
const { router: mockRouter } = jest.requireMock("expo-router") as {
  router: { push: jest.Mock; back: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ShareIntentScreen", () => {
  describe("URL受信", () => {
    it("共有URLがSave画面にプリセットされること", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: { webUrl: "https://zenn.dev/test/articles/react-native" },
        isReady: true,
        hasShareIntent: true,
        error: null,
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: "/article/save",
          params: { url: "https://zenn.dev/test/articles/react-native" },
        });
      });
    });

    it("URLが存在しない場合はSave画面に遷移しないこと", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: { webUrl: null },
        isReady: true,
        hasShareIntent: false,
        error: null,
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      await waitFor(() => {
        expect(mockRouter.push).not.toHaveBeenCalled();
      });
    });

    it("shareIntentがnullの場合はSave画面に遷移しないこと", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: null,
        isReady: true,
        hasShareIntent: false,
        error: null,
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      await waitFor(() => {
        expect(mockRouter.push).not.toHaveBeenCalled();
      });
    });

    it("isReadyがfalseの場合はローディング表示になること", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: null,
        isReady: false,
        hasShareIntent: false,
        error: null,
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      expect(screen.getByLabelText("share-intent-loading")).toBeTruthy();
    });

    it("エラー発生時はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: null,
        isReady: true,
        hasShareIntent: false,
        error: new Error("共有の読み取りに失敗しました"),
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      expect(screen.getByLabelText("share-intent-error")).toBeTruthy();
      expect(screen.getByLabelText("share-intent-error-message")).toBeTruthy();
    });

    it("閉じるボタンを押すと戻ること", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: null,
        isReady: true,
        hasShareIntent: false,
        error: new Error("エラー"),
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);
      await fireEvent.press(screen.getByLabelText("閉じる"));

      // Assert
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    it("無効なURL形式の場合はSave画面に遷移しないこと", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: { webUrl: "not-a-valid-url" },
        isReady: true,
        hasShareIntent: true,
        error: null,
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      await waitFor(() => {
        expect(mockRouter.push).not.toHaveBeenCalled();
      });
    });

    it("遷移後にresetShareIntentが呼ばれること", async () => {
      // Arrange
      const mockReset = jest.fn();
      mockUseShareIntent.mockReturnValue({
        shareIntent: { webUrl: "https://example.com/article" },
        isReady: true,
        hasShareIntent: true,
        error: null,
        resetShareIntent: mockReset,
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledTimes(1);
      });
    });

    it("URLが見つからない場合はフォールバックUIが表示されること", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: { webUrl: null },
        isReady: true,
        hasShareIntent: false,
        error: null,
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);

      // Assert
      await waitFor(() => {
        expect(screen.getByLabelText("share-intent-not-found")).toBeTruthy();
        expect(screen.getByLabelText("share-intent-not-found-message")).toBeTruthy();
      });
    });

    it("フォールバックUIの閉じるボタンを押すと戻ること", async () => {
      // Arrange
      mockUseShareIntent.mockReturnValue({
        shareIntent: { webUrl: null },
        isReady: true,
        hasShareIntent: false,
        error: null,
        resetShareIntent: jest.fn(),
      });

      // Act
      await render(<ShareIntentScreen />);
      await fireEvent.press(screen.getByLabelText("閉じる"));

      // Assert
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });
  });
});
