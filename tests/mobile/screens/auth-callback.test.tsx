import OAuthCallbackScreen from "@mobile-app/(auth)/oauth-callback";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCheckSession = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
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

jest.mock("expo-linking", () => ({
  useURL: jest.fn(() => null),
  parse: jest.fn((url: string) => {
    const parsed = new URL(url);
    const queryParams: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    return { queryParams };
  }),
}));

const mockUseURL = jest.requireMock("expo-linking").useURL;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OAuthCallbackScreen", () => {
  describe("コールバックURLのパラメータ処理", () => {
    it("ローディング中はActivityIndicatorが表示されること", async () => {
      // Arrange
      mockUseURL.mockReturnValue(null);
      mockCheckSession.mockImplementation(() => new Promise(() => {}));

      // Act
      const { getByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      expect(getByTestId("oauth-callback-loading")).toBeDefined();
    });

    it("URLパラメータにcodeが含まれる場合にsession確認を実行すること", async () => {
      // Arrange
      mockCheckSession.mockResolvedValue(undefined);
      mockUseURL.mockReturnValue("techclip://oauth-callback?code=auth_code_123");

      // Act
      await render(<OAuthCallbackScreen />);

      // Assert
      await waitFor(() => {
        expect(mockCheckSession).toHaveBeenCalled();
      });
    });

    it("URLパラメータにerrorが含まれる場合はsession確認を実行しないこと", async () => {
      // Arrange
      mockUseURL.mockReturnValue("techclip://oauth-callback?error=access_denied");

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
      mockUseURL.mockReturnValue("techclip://oauth-callback?code=auth_code_123");

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
      mockUseURL.mockReturnValue("techclip://oauth-callback?error=access_denied");

      // Act
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("oauth-callback-error");
      expect(errorEl).toBeDefined();
    });

    it("checkSessionが失敗した場合はエラーメッセージが表示されること", async () => {
      // Arrange
      mockCheckSession.mockRejectedValue(new Error("セッション確認に失敗しました"));
      mockUseURL.mockReturnValue("techclip://oauth-callback?code=auth_code_123");

      // Act
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      const errorEl = await findByTestId("oauth-callback-error");
      expect(errorEl).toBeDefined();
    });

    it("エラー時にログイン画面に戻るボタンが表示されること", async () => {
      // Arrange
      mockUseURL.mockReturnValue("techclip://oauth-callback?error=access_denied");

      // Act
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Assert
      const backBtn = await findByTestId("oauth-callback-back-button");
      expect(backBtn).toBeDefined();
    });

    it("ログイン画面に戻るボタンを押すとlogin画面へ遷移すること", async () => {
      // Arrange
      mockUseURL.mockReturnValue("techclip://oauth-callback?error=access_denied");
      const { findByTestId } = await render(<OAuthCallbackScreen />);

      // Act
      const backBtn = await findByTestId("oauth-callback-back-button");
      fireEvent.press(backBtn);

      // Assert
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    });
  });
});
