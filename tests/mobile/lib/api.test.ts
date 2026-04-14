import Constants from "expo-constants";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiUrl: "http://test-api.example.com" },
    },
  },
}));

jest.mock("@mobile/lib/secure-store", () => ({
  getAuthToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clearAuthTokens: jest.fn(),
}));

import {
  ApiError,
  ApiHttpError,
  ApiNetworkError,
  ApiParseError,
  apiFetch,
  SessionExpiredError,
} from "@mobile/lib/api";
import {
  clearAuthTokens,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from "@mobile/lib/secure-store";

/** モック型キャスト */
const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;
const mockGetRefreshToken = getRefreshToken as jest.MockedFunction<typeof getRefreshToken>;
const mockSetAuthToken = setAuthToken as jest.MockedFunction<typeof setAuthToken>;
const mockSetRefreshToken = setRefreshToken as jest.MockedFunction<typeof setRefreshToken>;
const mockClearAuthTokens = clearAuthTokens as jest.MockedFunction<typeof clearAuthTokens>;

/** fetchモック */
const mockFetch = jest.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

/** fetchレスポンスモックのオプション */
type CreateFetchResponseOptions = {
  status?: number;
  contentType?: string | null;
  jsonImpl?: () => Promise<unknown>;
  textImpl?: () => Promise<string>;
};

/**
 * fetchレスポンスのモックヘルパー
 */
function createFetchResponse(body: unknown, options: CreateFetchResponseOptions = {}): Response {
  const { status = 200, contentType = "application/json", jsonImpl, textImpl } = options;

  const headers = {
    get: (name: string): string | null => {
      if (name.toLowerCase() === "content-type") {
        return contentType;
      }
      return null;
    },
  };

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: jsonImpl ? jest.fn(jsonImpl) : jest.fn().mockResolvedValue(body),
    text: textImpl
      ? jest.fn(textImpl)
      : jest.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe("apiFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthToken.mockResolvedValue("valid-access-token");
    mockGetRefreshToken.mockResolvedValue("valid-refresh-token");
    mockSetAuthToken.mockResolvedValue(undefined);
    mockSetRefreshToken.mockResolvedValue(undefined);
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

    it("FormDataを送信する場合はContent-Typeヘッダーを設定しないこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(createFetchResponse({ success: true, data: { id: "1" } }));
      const formData = new FormData();
      formData.append("file", "dummy");

      // Act
      await apiFetch<{ success: true; data: { id: string } }>("/users/me/profile", {
        method: "PATCH",
        body: formData,
      });

      // Assert
      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });

    it("JSON本文を送信する場合はContent-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(createFetchResponse({ success: true, data: { id: "1" } }));

      // Act
      await apiFetch<{ success: true; data: { id: string } }>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: "テスト" }),
      });

      // Assert
      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("トークンリフレッシュ", () => {
    it("401レスポンス時にリフレッシュトークンでトークンを更新して再試行できること", async () => {
      // Arrange
      const newToken = "new-access-token";
      const newRefreshToken = "next-refresh-token";
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        )
        .mockResolvedValueOnce(
          createFetchResponse({
            success: true,
            data: { token: newToken, refreshToken: newRefreshToken },
          }),
        )
        .mockResolvedValueOnce(createFetchResponse({ success: true, data: { id: "1" } }));

      // Act
      const result = await apiFetch<{ success: true; data: { id: string } }>("/articles");

      // Assert
      expect(mockSetAuthToken).toHaveBeenCalledWith(newToken);
      expect(mockSetRefreshToken).toHaveBeenCalledWith(newRefreshToken);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true, data: { id: "1" } });
    });

    it("401レスポンス時にリフレッシュトークンがなければSessionExpiredErrorをスローすること", async () => {
      // Arrange
      mockGetRefreshToken.mockResolvedValue(null);
      mockFetch.mockResolvedValue(
        createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("リフレッシュAPIが失敗した場合はSessionExpiredErrorをスローすること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        )
        .mockResolvedValueOnce(
          createFetchResponse(
            { success: false, error: { code: "REFRESH_FAILED" } },
            { status: 401 },
          ),
        );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("リフレッシュ後の再試行が401を返した場合はSessionExpiredErrorをスローすること", async () => {
      // Arrange
      const newToken = "new-access-token";
      const newRefreshToken = "next-refresh-token";
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        )
        .mockResolvedValueOnce(
          createFetchResponse({
            success: true,
            data: { token: newToken, refreshToken: newRefreshToken },
          }),
        )
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("401以外のエラーで業務エラーJSONが返った場合はそのままデータを返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse(
          { success: false, error: { code: "NOT_FOUND", message: "見つかりません" } },
          { status: 404 },
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

  describe("HTTPエラー応答の耐性", () => {
    it("5xxで業務エラーJSONが返った場合はそのままデータを返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse(
          {
            success: false,
            error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
          },
          { status: 500 },
        ),
      );

      // Act
      const result = await apiFetch("/articles");

      // Assert
      expect(result).toEqual({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
      });
    });

    it("500で非JSONレスポンスが返った場合はApiHttpErrorをスローすること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse("<html>Internal Server Error</html>", {
          status: 500,
          contentType: "text/html; charset=utf-8",
        }),
      );

      // Act
      let caughtError: unknown;
      try {
        await apiFetch("/articles");
      } catch (e) {
        caughtError = e;
      }

      // Assert
      expect(caughtError).toBeInstanceOf(ApiHttpError);
      expect((caughtError as ApiHttpError).status).toBe(500);
    });

    it("502で本文が空の場合はApiHttpErrorをスローすること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse("", {
          status: 502,
          contentType: "text/plain",
          jsonImpl: () => Promise.reject(new Error("Unexpected token")),
          textImpl: () => Promise.resolve(""),
        }),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(ApiHttpError);
    });

    it("4xxで非JSONレスポンスが返った場合はApiHttpErrorをスローすること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse("Bad Request", {
          status: 400,
          contentType: "text/plain",
        }),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(ApiHttpError);
    });
  });

  describe("非JSON応答の耐性", () => {
    it("2xxでJSONパースに失敗した場合はApiParseErrorをスローすること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse("<html>Maintenance</html>", {
          status: 200,
          contentType: "text/html",
          jsonImpl: () => Promise.reject(new Error("Unexpected token")),
        }),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(ApiParseError);
    });

    it("2xxでContent-Typeがapplication/jsonでもパースが失敗したらApiParseErrorをスローすること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse("not a json", {
          status: 200,
          contentType: "application/json",
          jsonImpl: () => Promise.reject(new Error("Unexpected token")),
        }),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(ApiParseError);
    });

    it("Content-Typeヘッダーが無い場合でも2xxならパースを試みて成功すれば返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse(
          { success: true, data: { id: "1" } },
          { status: 200, contentType: null },
        ),
      );

      // Act
      const result = await apiFetch<{ success: true; data: { id: string } }>("/articles");

      // Assert
      expect(result).toEqual({ success: true, data: { id: "1" } });
    });
  });

  describe("ネットワークエラーの耐性", () => {
    it("fetchがTypeErrorでrejectされた場合はApiNetworkErrorをスローすること", async () => {
      // Arrange
      mockFetch.mockRejectedValue(new TypeError("Network request failed"));

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(ApiNetworkError);
    });

    it("AbortErrorでタイムアウトした場合はApiNetworkErrorをスローすること", async () => {
      // Arrange
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(ApiNetworkError);
    });
  });

  describe("リフレッシュAPIの耐性", () => {
    it("リフレッシュAPIが非JSONを返した場合はSessionExpiredErrorにラップされること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        )
        .mockResolvedValueOnce(
          createFetchResponse("<html>Service Unavailable</html>", {
            status: 503,
            contentType: "text/html",
          }),
        );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("リフレッシュAPIがネットワークエラーになった場合はSessionExpiredErrorにラップされること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        )
        .mockRejectedValueOnce(new TypeError("Network request failed"));

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toThrow(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe("SessionExpiredError", () => {
    it("SessionExpiredErrorはErrorのサブクラスであること", async () => {
      // Arrange & Act
      const error = new SessionExpiredError();

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(SessionExpiredError);
      expect(error.message).toBe("セッションの有効期限が切れました。再度ログインしてください");
    });
  });

  describe("ApiHttpError", () => {
    it("statusプロパティとメッセージを保持すること", () => {
      // Arrange & Act
      const error = new ApiHttpError(500, "サーバーエラーが発生しました");

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(ApiHttpError);
      expect(error.status).toBe(500);
      expect(error.message).toBe("サーバーエラーが発生しました");
      expect(error.name).toBe("ApiHttpError");
    });
  });

  describe("ApiNetworkError", () => {
    it("causeとメッセージを保持すること", () => {
      // Arrange
      const cause = new TypeError("Network request failed");

      // Act
      const error = new ApiNetworkError("ネットワークに接続できません", cause);

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(ApiNetworkError);
      expect(error.message).toBe("ネットワークに接続できません");
      expect(error.name).toBe("ApiNetworkError");
      expect(error.cause).toBe(cause);
    });
  });

  describe("ApiParseError", () => {
    it("statusとメッセージを保持すること", () => {
      // Arrange & Act
      const error = new ApiParseError(200, "レスポンスの解析に失敗しました");

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(ApiParseError);
      expect(error.status).toBe(200);
      expect(error.message).toBe("レスポンスの解析に失敗しました");
      expect(error.name).toBe("ApiParseError");
    });
  });

  describe("リフレッシュ応答の境界ケース", () => {
    it("リフレッシュ応答が { success: true } のみ（data なし）のときSessionExpiredErrorになること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        )
        .mockResolvedValueOnce(createFetchResponse({ success: true }));

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toBeInstanceOf(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalled();
    });

    it("リフレッシュ応答が { success: true, data: null } のときSessionExpiredErrorになること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse({ success: false, error: { code: "AUTH_EXPIRED" } }, { status: 401 }),
        )
        .mockResolvedValueOnce(createFetchResponse({ success: true, data: null }));

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toBeInstanceOf(SessionExpiredError);
      expect(mockClearAuthTokens).toHaveBeenCalled();
    });

    it("非2xxで { success: false, error: null } のときApiHttpErrorがスローされること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse({ success: false, error: null }, { status: 500 }),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toBeInstanceOf(ApiHttpError);
    });

    it("2xxでContent-Typeがtext/plainかつ有効なJSONのときApiParseErrorが投げられること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse(
          { success: true, data: {} },
          {
            status: 200,
            contentType: "text/plain",
          },
        ),
      );

      // Act & Assert
      await expect(apiFetch("/articles")).rejects.toBeInstanceOf(ApiParseError);
    });
  });

  describe("getBaseUrl", () => {
    it("extra.apiUrlが設定されている場合はその値をベースURLとして使用すること", async () => {
      // Arrange（モックは上部でhttp://test-api.example.comを返すよう設定済み）
      mockGetAuthToken.mockResolvedValue(null);
      mockFetch.mockResolvedValue(createFetchResponse({ success: true, data: [] }));

      // Act
      await apiFetch("/test");

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test-api.example.com/test",
        expect.any(Object),
      );
    });

    it("extra.apiUrlが未設定の場合はlocalhost:8787をフォールバックとして使用すること", async () => {
      // Arrange
      const originalConfig = Constants.expoConfig;
      Object.defineProperty(Constants, "expoConfig", {
        value: { extra: {} },
        writable: true,
        configurable: true,
      });
      mockGetAuthToken.mockResolvedValue(null);
      mockFetch.mockResolvedValue(createFetchResponse({ success: true, data: [] }));

      // Act
      await apiFetch("/test");

      // Assert
      expect(mockFetch).toHaveBeenCalledWith("http://localhost:8787/test", expect.any(Object));

      // Cleanup
      Object.defineProperty(Constants, "expoConfig", {
        value: originalConfig,
        writable: true,
        configurable: true,
      });
    });
  });
});
