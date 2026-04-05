import AuthCallbackScreen from "@mobile-app/auth/callback";
import { render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockCheckSession = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
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

const mockUseLocalSearchParams = jest.requireMock("expo-router").useLocalSearchParams;

beforeEach(() => {
  jest.clearAllMocks();
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

  describe("異常系", () => {
    it("errorパラメータがある場合はlogin画面へフォールバックすること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });

      // Act
      await render(<AuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockCheckSession).not.toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
      });
    });

    it("tokenがない場合はlogin画面へフォールバックすること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({});

      // Act
      await render(<AuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockCheckSession).not.toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
      });
    });

    it("非同期処理で例外が発生した場合はlogin画面へフォールバックすること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ token: "access_token_123" });
      (mockSetAuthToken as jest.Mock).mockRejectedValue(
        new Error("ストレージへの書き込みに失敗しました"),
      );

      // Act
      await render(<AuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
      });
    });

    it("checkSessionで例外が発生した場合はlogin画面へフォールバックすること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ token: "access_token_123" });
      (mockSetAuthToken as jest.Mock).mockResolvedValue(undefined);
      mockCheckSession.mockRejectedValue(new Error("セッション確認に失敗しました"));

      // Act
      await render(<AuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
      });
    });
  });
});
