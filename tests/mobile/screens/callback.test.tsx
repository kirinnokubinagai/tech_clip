import AuthCallbackScreen from "@mobile-app/auth/callback";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockCheckSession = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockFetchWithTimeout = jest.fn();
const mockGetBaseUrl = jest.fn(() => "https://api.example.com");

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
  getOAuthState: jest.fn(),
  removeOAuthState: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
  getBaseUrl: () => mockGetBaseUrl(),
}));

import {
  getOAuthState as mockGetOAuthState,
  removeOAuthState as mockRemoveOAuthState,
  setAuthToken as mockSetAuthToken,
  setRefreshToken as mockSetRefreshToken,
} from "@/lib/secure-store";

/** 有効な exchange API レスポンス */
function makeExchangeResponse(overrides: Partial<{ token: string; refreshToken: string }> = {}) {
  return {
    json: jest.fn().mockResolvedValue({
      success: true,
      data: {
        session: {
          token: overrides.token ?? "session-token-abc",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
        refreshToken: overrides.refreshToken ?? "refresh-token-xyz",
      },
    }),
    status: 200,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({});
  (mockGetOAuthState as jest.Mock).mockResolvedValue(null);
  (mockRemoveOAuthState as jest.Mock).mockResolvedValue(undefined);
  mockFetchWithTimeout.mockResolvedValue(makeExchangeResponse());
  mockCheckSession.mockResolvedValue(undefined);
});

describe("AuthCallbackScreen", () => {
  describe("正常系", () => {
    it("code 受信後に /mobile-exchange を呼んでトークン保存し tabs へ遷移できること", async () => {
      // Arrange
      const validCode = "a".repeat(64);
      (mockGetOAuthState as jest.Mock).mockResolvedValue("nonce_abc");
      mockUseLocalSearchParams.mockReturnValue({ code: validCode, state: "nonce_abc" });
      (mockSetAuthToken as jest.Mock).mockResolvedValue(undefined);
      (mockSetRefreshToken as jest.Mock).mockResolvedValue(undefined);

      // Act
      await render(<AuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockFetchWithTimeout).toHaveBeenCalledWith(
          "https://api.example.com/api/auth/mobile-exchange",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ code: validCode }),
          }),
        );
        expect(mockSetAuthToken).toHaveBeenCalledWith("session-token-abc");
        expect(mockSetRefreshToken).toHaveBeenCalledWith("refresh-token-xyz");
        expect(mockCheckSession).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      });
    });
  });

  describe("ローディング状態", () => {
    it("checkSession が完了しない間は ActivityIndicator が表示されること", async () => {
      // Arrange
      const validCode = "a".repeat(64);
      (mockGetOAuthState as jest.Mock).mockResolvedValue("nonce_abc");
      mockUseLocalSearchParams.mockReturnValue({ code: validCode, state: "nonce_abc" });
      (mockSetAuthToken as jest.Mock).mockResolvedValue(undefined);
      (mockSetRefreshToken as jest.Mock).mockResolvedValue(undefined);
      mockCheckSession.mockReturnValue(new Promise(() => {}));

      // Act
      const { getByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      expect(getByTestId("auth-callback-loading").props.testID).toBe("auth-callback-loading");
    });
  });

  describe("異常系", () => {
    it("error パラメータがある場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("auth-callback-error");
      expect(errorEl.props.testID).toBe("auth-callback-error");
      expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    });

    it("code がない場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({});

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("auth-callback-error");
      expect(errorEl.props.testID).toBe("auth-callback-error");
      expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    });

    it("state が不一致の場合はエラーになること", async () => {
      // Arrange
      const validCode = "a".repeat(64);
      (mockGetOAuthState as jest.Mock).mockResolvedValue("nonce_abc");
      mockUseLocalSearchParams.mockReturnValue({ code: validCode, state: "nonce_WRONG" });

      // Act
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("auth-callback-error");
      expect(errorEl.props.testID).toBe("auth-callback-error");
      expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    });

    it("exchange API が 401 を返した場合はエラーになること", async () => {
      // Arrange
      const validCode = "a".repeat(64);
      (mockGetOAuthState as jest.Mock).mockResolvedValue("nonce_abc");
      mockUseLocalSearchParams.mockReturnValue({ code: validCode, state: "nonce_abc" });
      mockFetchWithTimeout.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          success: false,
          error: { code: "AUTH_INVALID", message: "認証コードが無効または期限切れです" },
        }),
        status: 401,
      });

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

    it("ログイン画面に戻るボタンを押すと login 画面へ遷移すること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });
      const { findByTestId } = await render(<AuthCallbackScreen />);

      // Act
      const backBtn = await findByTestId("auth-callback-back-button");
      fireEvent.press(backBtn);

      // Assert
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    });
  });
});
