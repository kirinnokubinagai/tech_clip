import AuthCallbackScreen from "@mobile-app/auth/callback";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockCheckSession = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  get useLocalSearchParams() {
    return mockUseLocalSearchParams;
  },
}));

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: { checkSession: jest.Mock }) => unknown) =>
    selector({
      checkSession: mockCheckSession,
    }),
  ),
}));

jest.mock("@/lib/secure-store", () => ({
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

import {
  setAuthToken as mockSetAuthToken,
  setRefreshToken as mockSetRefreshToken,
} from "@/lib/secure-store";

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({});
});

describe("AuthCallbackScreen", () => {
  describe("正常系", () => {
    it("tokenがある場合にセキュアストレージへ保存してホーム画面へ遷移できること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ token: "access_token_123" });
      (mockSetAuthToken as jest.Mock).mockResolvedValue(undefined);
      mockCheckSession.mockResolvedValue(undefined);

      // Act
      await render(<AuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockSetAuthToken).toHaveBeenCalledWith("access_token_123");
        expect(mockCheckSession).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      });
    });

    it("refresh_tokenも含む場合にリフレッシュトークンも保存できること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({
        token: "access_token_123",
        refresh_token: "refresh_token_456",
      });
      (mockSetAuthToken as jest.Mock).mockResolvedValue(undefined);
      (mockSetRefreshToken as jest.Mock).mockResolvedValue(undefined);
      mockCheckSession.mockResolvedValue(undefined);

      // Act
      await render(<AuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockSetAuthToken).toHaveBeenCalledWith("access_token_123");
        expect(mockSetRefreshToken).toHaveBeenCalledWith("refresh_token_456");
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      });
    });
  });

  describe("ローディング状態", () => {
    it("checkSessionが完了しない間はActivityIndicatorが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ token: "access_token_123" });
      (mockSetAuthToken as jest.Mock).mockResolvedValue(undefined);
      mockCheckSession.mockReturnValue(new Promise(() => {}));

      // Act
      const { getByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      expect(getByTestId("auth-callback-loading").props.testID).toBe("auth-callback-loading");
    });
  });

  describe("異常系", () => {
    it("errorパラメータがある場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("auth-callback-error");
      expect(errorEl.props.testID).toBe("auth-callback-error");
      expect(mockCheckSession).not.toHaveBeenCalled();
    });

    it("tokenがない場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({});

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("auth-callback-error");
      expect(errorEl.props.testID).toBe("auth-callback-error");
      expect(mockCheckSession).not.toHaveBeenCalled();
    });

    it("エラー時にログイン画面に戻るボタンが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const backBtn = await findByTestId("auth-callback-back-button");
      expect(backBtn.props.testID).toBe("auth-callback-back-button");
    });

    it("ログイン画面に戻るボタンを押すとlogin画面へ遷移すること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Act
      const backBtn = await findByTestId("auth-callback-back-button");
      fireEvent.press(backBtn);

      // Assert
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    });

    it("setAuthTokenで例外が発生した場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ token: "access_token_123" });
      (mockSetAuthToken as jest.Mock).mockRejectedValue(
        new Error("ストレージへの書き込みに失敗しました"),
      );

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("auth-callback-error");
      expect(errorEl.props.testID).toBe("auth-callback-error");
    });

    it("checkSessionで例外が発生した場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ token: "access_token_123" });
      (mockSetAuthToken as jest.Mock).mockResolvedValue(undefined);
      mockCheckSession.mockRejectedValue(new Error("セッション確認に失敗しました"));

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("auth-callback-error");
      expect(errorEl.props.testID).toBe("auth-callback-error");
    });
  });
});
