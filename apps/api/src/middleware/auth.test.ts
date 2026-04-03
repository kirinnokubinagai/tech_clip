import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createAuthMiddleware } from "./auth";

/** レスポンスボディの型定義 */
type AuthResponseBody = {
  success?: boolean;
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
};

/** テスト用のBetter Auth シークレット */
const _TEST_SECRET = "test-secret-key-for-better-auth-min-32-chars!!";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
  emailVerified: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** テスト用のモックセッション */
const MOCK_SESSION = {
  id: "session_01HXYZ",
  userId: "user_01HXYZ",
  expiresAt: new Date("2099-12-31"),
  token: "valid-session-token",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** テスト用のモックAuth（getSessionが成功するケース） */
function createMockAuthSuccess() {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue({
        session: MOCK_SESSION,
        user: MOCK_USER,
      }),
    },
    handler: vi.fn(),
  };
}

/** テスト用のモックAuth（getSessionがnullを返すケース） */
function createMockAuthFailure() {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
    handler: vi.fn(),
  };
}

/** テスト用Honoアプリを作成する */
function createTestApp(mockAuth: ReturnType<typeof createMockAuthSuccess>) {
  type Variables = {
    user: typeof MOCK_USER;
    session: typeof MOCK_SESSION;
  };
  const app = new Hono<{ Variables: Variables }>();

  const middleware = createAuthMiddleware(() => mockAuth);
  app.use("/protected/*", middleware);
  app.get("/protected/resource", (c) => {
    const user = c.get("user");
    const session = c.get("session");
    return c.json({ user, session });
  });
  app.get("/public", (c) => c.json({ message: "公開リソース" }));

  return app;
}

describe("authMiddleware", () => {
  describe("認証成功", () => {
    it("有効なAuthorizationヘッダーでユーザー情報がコンテキストにセットされること", async () => {
      // Arrange
      const mockAuth = createMockAuthSuccess();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource", {
        headers: {
          Authorization: "Bearer valid-session-token",
        },
      });

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthResponseBody;
      expect(body.user).toMatchObject({
        id: MOCK_USER.id,
        email: MOCK_USER.email,
      });
    });

    it("有効なセッションでsession情報がコンテキストにセットされること", async () => {
      // Arrange
      const mockAuth = createMockAuthSuccess();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource", {
        headers: {
          Authorization: "Bearer valid-session-token",
        },
      });

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthResponseBody;
      expect(body.session).toMatchObject({
        id: MOCK_SESSION.id,
        userId: MOCK_SESSION.userId,
      });
    });

    it("auth.api.getSessionにリクエストが渡されること", async () => {
      // Arrange
      const mockAuth = createMockAuthSuccess();
      const app = createTestApp(mockAuth);

      // Act
      await app.request("/protected/resource", {
        headers: {
          Authorization: "Bearer valid-session-token",
        },
      });

      // Assert
      expect(mockAuth.api.getSession).toHaveBeenCalledTimes(1);
      const calledWith = mockAuth.api.getSession.mock.calls[0][0];
      expect(calledWith).toHaveProperty("headers");
    });
  });

  describe("認証失敗", () => {
    it("Authorizationヘッダーがない場合401が返ること", async () => {
      // Arrange
      const mockAuth = createMockAuthFailure();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource");

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "ログインが必要です",
        },
      });
    });

    it("無効なトークンの場合401が返ること", async () => {
      // Arrange
      const mockAuth = createMockAuthFailure();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "ログインが必要です",
        },
      });
    });

    it("セッション検証でnullが返った場合401が返ること", async () => {
      // Arrange
      const mockAuth = createMockAuthFailure();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource", {
        headers: {
          Authorization: "Bearer expired-token",
        },
      });

      // Assert
      expect(res.status).toBe(401);
    });
  });

  describe("Cookieベース認証", () => {
    it("Cookieにセッショントークンがある場合も認証が成功すること", async () => {
      // Arrange
      const mockAuth = createMockAuthSuccess();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource", {
        headers: {
          Cookie: "better-auth.session_token=valid-session-token",
        },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(mockAuth.api.getSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("レスポンス形式", () => {
    it("401レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const mockAuth = createMockAuthFailure();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource");

      // Assert
      expect(res.status).toBe(401);
      const body = (await res.json()) as AuthResponseBody;
      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const mockAuth = createMockAuthFailure();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/protected/resource");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });

  describe("ミドルウェア未適用ルート", () => {
    it("保護されていないルートは認証なしでアクセスできること", async () => {
      // Arrange
      const mockAuth = createMockAuthFailure();
      const app = createTestApp(mockAuth);

      // Act
      const res = await app.request("/public");

      // Assert
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ message: "公開リソース" });
    });
  });
});
