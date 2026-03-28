jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiUrl: "http://test-api.example.com" },
    },
  },
}));

jest.mock("./secure-store", () => ({
  getAuthToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setAuthToken: jest.fn(),
  clearAuthTokens: jest.fn(),
}));

import { clearAuthTokens, getAuthToken, getRefreshToken, setAuthToken } from "./secure-store";

import { SessionExpiredError, apiFetch } from "./api";

/** モック型キャスト */
const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;
const mockGetRefreshToken = getRefreshToken as jest.MockedFunction<typeof getRefreshToken>;
const mockSetAuthToken = setAuthToken as jest.MockedFunction<typeof setAuthToken>;
const mockClearAuthTokens = clearAuthTokens as jest.MockedFunction<typeof clearAuthTokens>;

/** fetchモック */
const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * fetchレスポンスのモックヘルパー
 */
function createFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("apiFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthToken.mockResolvedValue("valid-access-token");
    mockGetRefreshToken.mockResolvedValue("valid-refresh-token");
    mockSetAuthToken.mockResolvedValue(undefined);
    mockClearAuthTokens.mockResolvedValue(undefined);
  });

  describe("正常系", () => {
    it("認証トークンをAuthorizationヘッダーに付与してリクエストを送信できること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(createFetchResponse({ success: true, data: { id: "1" } }));

      // Act
      const result = await apiFetch<{ success: true; data: { id: string } }>("/articles");

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test-api.example.com/articles",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-access-token",
          }),
        }),
      );
      expect(result).toEqual({ success: true, data: { id: "1" } });
    });

    it("トークンがない場合はAuthorizationヘッダーなしでリクエストを送信できること", async () => {
      // Arrange
      mockGetAuthToken.mockResolvedValue(null);
      mockFetch.mockResolvedValue(createFetchResponse({ success: true, data: [] }));

      // Act
      await apiFetch<{ success: true; data: unknown[] }>("/public/articles");

      // Assert
      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("トークンリフレッシュ", () => {
    it("401レスポンス時にリフレッシュトークンでトークンを更新して再試行できること", async () => {
      // Arrange
      const newToken = "new-access-token";
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, 401),
        )
        .mockResolvedValueOnce(createFetchResponse({ success: true, data: { token: newToken } }))
        .mockResolvedValueOnce(createFetchResponse({ success: true, data: { id: "1" } }));

      // Act
      const result = await apiFetch<{ success: true; data: { id: string } }>("/articles");

      // Assert
      expect(mockSetAuthToken).toHaveBeenCalledWith(newToken);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true, data: { id: "1" } });
    });

    it("401レスポンス時にリフレッシュトークンがなければSessionExpiredErrorをスローすること", async () => {
      // Arrange
      mockGetRefreshToken.mockResolvedValue(null);
      mockFetch.mockResolvedValue(
        createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, 401),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("リフレッシュAPIが失敗した場合はSessionExpiredErrorをスローすること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, 401),
        )
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "REFRESH_FAILED" } }, 401),
        );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("リフレッシュ後の再試行が401を返した場合はSessionExpiredErrorをスローすること", async () => {
      // Arrange
      const newToken = "new-access-token";
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, 401),
        )
        .mockResolvedValueOnce(createFetchResponse({ success: true, data: { token: newToken } }))
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, 401),
        );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("401以外のエラーはそのままレスポンスデータを返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse(
          { success: false, error: { code: "NOT_FOUND", message: "見つかりません" } },
          404,
        ),
      );

      // Act
      const result = await apiFetch("/articles/999");

      // Assert
      expect(result).toEqual({
        success: false,
        error: { code: "NOT_FOUND", message: "見つかりません" },
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("SessionExpiredError", () => {
    it("SessionExpiredErrorはErrorのサブクラスであること", () => {
      // Arrange & Act
      const error = new SessionExpiredError();

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SessionExpiredError);
      expect(error.message).toBe("セッションの有効期限が切れました。再度ログインしてください");
    });
  });
});
