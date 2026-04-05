import OAuthCallbackScreen from "@mobile-app/(auth)/oauth-callback";
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
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      checkSession: mockCheckSession,
    }),
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({});
});

describe("OAuthCallbackScreen", () => {
  describe("コールバックURLのパラメータ処理", () => {
    it("codeあり・checkSession保留中はActivityIndicatorが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ code: "pending_code" });
      mockCheckSession.mockImplementation(() => new Promise(() => {}));

      // Act
      const { getByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      expect(getByTestId("oauth-callback-loading")).toBeDefined();
    });

    it("URLにcodeもerrorもない場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({});

      // Act
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("oauth-callback-error");
      expect(errorEl).toBeDefined();
      expect(mockCheckSession).not.toHaveBeenCalled();
    });

    it("URLパラメータにcodeが含まれる場合にsession確認を実行すること", async () => {
      // Arrange
      mockCheckSession.mockResolvedValue(undefined);
      mockUseLocalSearchParams.mockReturnValue({ code: "auth_code_123" });

      // Act
      await render(<OAuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockCheckSession).toHaveBeenCalled();
      });
    });

    it("URLパラメータにerrorが含まれる場合はsession確認を実行しないこと", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });

      // Act
      await render(<OAuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockCheckSession).not.toHaveBeenCalled();
      });
    });
  });

  describe("認証成功時", () => {
    it("checkSession成功後にホーム画面へ遷移すること", async () => {
      // Arrange
      mockCheckSession.mockResolvedValue(undefined);
      mockUseLocalSearchParams.mockReturnValue({ code: "auth_code_123" });

      // Act
      await render(<OAuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      });
    });
  });

  describe("認証失敗時", () => {
    it("URLパラメータにerrorが含まれる場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });

      // Act
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("oauth-callback-error");
      expect(errorEl).toBeDefined();
    });

    it("checkSessionが失敗した場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockCheckSession.mockRejectedValue(new Error("セッション確認に失敗しました"));
      mockUseLocalSearchParams.mockReturnValue({ code: "auth_code_123" });

      // Act
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("oauth-callback-error");
      expect(errorEl).toBeDefined();
    });

    it("エラー時にログイン画面に戻るボタンが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });

      // Act
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      const backBtn = await findByTestId("oauth-callback-back-button");
      expect(backBtn).toBeDefined();
    });

    it("ログイン画面に戻るボタンを押すとlogin画面へ遷移すること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ error: "access_denied" });
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Act
      const backBtn = await findByTestId("oauth-callback-back-button");
      fireEvent.press(backBtn);

      // Assert
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    });
  });
});
