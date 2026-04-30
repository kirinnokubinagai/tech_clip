import { handleMobileOAuthCallback } from "@api/app/auth-subapp";
import type { Auth } from "@api/auth";
import type { Database } from "@api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * テスト用セッションレコード（sessions テーブルの行）
 */
const MOCK_SESSION_ROW = {
  id: "session_01",
  userId: "user_01",
  token: "better-auth-session-token-abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  ipAddress: null,
  userAgent: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * テスト用 Better Auth セッション応答
 */
const MOCK_BA_SESSION = {
  session: {
    token: "better-auth-session-token-abc123",
    id: "session_01",
    userId: "user_01",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  user: {
    id: "user_01",
    email: "test@example.com",
    name: "テストユーザー",
  },
};

/** DB セッション検索モック */
const mockSessionWhere = vi.fn();
const mockSessionFrom = vi.fn().mockReturnValue({ where: mockSessionWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSessionFrom });

/** DB insert モック */
const mockInsertValues = vi.fn().mockResolvedValue([]);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

/** テスト用 DB モック */
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
} as unknown as Database;

/**
 * テスト用 Better Auth インスタンスを生成する
 *
 * @param session - getSession が返すセッション（null で未認証）
 * @returns モック Auth インスタンス
 */
function createMockAuth(session: typeof MOCK_BA_SESSION | null = MOCK_BA_SESSION): Auth {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue(session),
    },
  } as unknown as Auth;
}

describe("handleMobileOAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionWhere.mockResolvedValue([MOCK_SESSION_ROW]);
    mockInsertValues.mockResolvedValue([]);
  });

  describe("GET /api/auth/mobile-callback", () => {
    it("有効なセッションクッキーがある場合に deep link へ 302 リダイレクトすること", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_BA_SESSION);
      const request = new Request("https://api.techclip.app/api/auth/mobile-callback", {
        method: "GET",
        headers: {
          Cookie: "better-auth.session_token=signed-token-here",
        },
      });

      // Act
      const response = await handleMobileOAuthCallback(mockDb, auth, request);

      // Assert
      expect(response.status).toBe(302);
      const location = response.headers.get("Location");
      expect(location).toBeTruthy();
      expect(location).toMatch(/^techclip:\/\/auth\/callback\?/);
    });

    it("リダイレクト先 URL に code パラメータが含まれること", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_BA_SESSION);
      const request = new Request("https://api.techclip.app/api/auth/mobile-callback", {
        method: "GET",
        headers: {
          Cookie: "better-auth.session_token=signed-token-here",
        },
      });

      // Act
      const response = await handleMobileOAuthCallback(mockDb, auth, request);

      // Assert
      const location = response.headers.get("Location");
      expect(location).toBeTruthy();
      const url = new URL(location ?? "");
      expect(url.searchParams.get("code")).toBeTruthy();
      expect(url.searchParams.get("code")).toHaveLength(64);
    });

    it("リダイレクト先 URL に token が含まれないこと", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_BA_SESSION);
      const request = new Request("https://api.techclip.app/api/auth/mobile-callback", {
        method: "GET",
        headers: {
          Cookie: "better-auth.session_token=signed-token-here",
        },
      });

      // Act
      const response = await handleMobileOAuthCallback(mockDb, auth, request);

      // Assert
      const location = response.headers.get("Location");
      expect(location).not.toContain("token=");
      expect(location).not.toContain("refresh_token=");
    });

    it("state パラメータが引き継がれること", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_BA_SESSION);
      const request = new Request(
        "https://api.techclip.app/api/auth/mobile-callback?state=nonce_abc",
        {
          method: "GET",
          headers: {
            Cookie: "better-auth.session_token=signed-token-here",
          },
        },
      );

      // Act
      const response = await handleMobileOAuthCallback(mockDb, auth, request);

      // Assert
      const location = response.headers.get("Location");
      expect(location).toBeTruthy();
      const url = new URL(location ?? "");
      expect(url.searchParams.get("state")).toBe("nonce_abc");
    });

    it("oauth_exchange_codes テーブルに行が insert されること", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_BA_SESSION);
      const request = new Request("https://api.techclip.app/api/auth/mobile-callback", {
        method: "GET",
        headers: {
          Cookie: "better-auth.session_token=signed-token-here",
        },
      });

      // Act
      await handleMobileOAuthCallback(mockDb, auth, request);

      // Assert: refresh_tokens + oauth_exchange_codes の 2 回 insert
      expect(mockInsert).toHaveBeenCalledTimes(2);
      expect(mockInsertValues).toHaveBeenCalledTimes(2);
    });

    it("セッションが存在しない場合は error パラメータ付きで deep link にリダイレクトすること", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const request = new Request("https://api.techclip.app/api/auth/mobile-callback", {
        method: "GET",
      });

      // Act
      const response = await handleMobileOAuthCallback(mockDb, auth, request);

      // Assert
      expect(response.status).toBe(302);
      const location = response.headers.get("Location");
      expect(location).toMatch(/^techclip:\/\/auth\/callback\?/);
      expect(location).toContain("error=");
    });

    it("sessions テーブルにセッションが見つからない場合は error パラメータ付きで deep link にリダイレクトすること", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_BA_SESSION);
      mockSessionWhere.mockResolvedValue([]);
      const request = new Request("https://api.techclip.app/api/auth/mobile-callback", {
        method: "GET",
        headers: {
          Cookie: "better-auth.session_token=signed-token-here",
        },
      });

      // Act
      const response = await handleMobileOAuthCallback(mockDb, auth, request);

      // Assert
      expect(response.status).toBe(302);
      const location = response.headers.get("Location");
      expect(location).toMatch(/^techclip:\/\/auth\/callback\?/);
      expect(location).toContain("error=");
    });
  });
});
