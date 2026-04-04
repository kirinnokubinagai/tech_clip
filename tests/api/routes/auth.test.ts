import {
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "@api/lib/http-status";
import { createAuthRoute } from "@api/routes/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用セッショントークン */
const MOCK_TOKEN = "mock-session-token-abc123";

/** テスト用セッション ID（リフレッシュトークンとして使用） */
const MOCK_SESSION_ID = "session_01";
const MOCK_REFRESH_TOKEN_ID = "refresh_01";
const MOCK_REFRESH_TOKEN = "refresh-token-opaque-value";

/** テスト用ユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
  image: null,
  createdAt: "2024-01-15T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
};

/** テスト用セッション行 */
const MOCK_SESSION_ROW = {
  id: MOCK_SESSION_ID,
  userId: MOCK_USER.id,
  token: MOCK_TOKEN,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  ipAddress: null,
  userAgent: null,
  createdAt: "2024-01-15T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
};

/** モック DB */
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

/** モック Better Auth インスタンス */
const mockAuth = {
  api: {
    signInEmail: vi.fn(),
    getSession: vi.fn(),
  },
};

/** エラーレスポンスの型 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
};

/** 成功レスポンスの型（サインイン・セッション） */
type AuthSuccessBody = {
  success: true;
  data: {
    user: { id: string; email: string; name: string };
    session: { token: string; refreshToken: string; expiresAt: string };
  };
};

/** 成功レスポンスの型（リフレッシュ） */
type RefreshSuccessBody = {
  success: true;
  data: { token: string; refreshToken: string };
};

/**
 * テスト用Honoアプリを作成する
 */
function createTestApp() {
  const app = new Hono();
  const authRoute = createAuthRoute({
    db: mockDb as never,
    getAuth: () => mockAuth,
  });
  app.route("/api/auth", authRoute);
  return app;
}

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("有効な認証情報でサインインできること", async () => {
      // Arrange
      mockAuth.api.signInEmail.mockResolvedValue({
        token: MOCK_TOKEN,
        user: MOCK_USER,
      });
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([MOCK_SESSION_ROW]),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.insert.mockReturnValue(insertChain);

      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "Password123" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as AuthSuccessBody;
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("test@example.com");
      expect(body.data.session.token).toBe(MOCK_TOKEN);
    });

    it("サインイン成功時にレスポンスにrefreshTokenが含まれること", async () => {
      // Arrange
      mockAuth.api.signInEmail.mockResolvedValue({
        token: MOCK_TOKEN,
        user: MOCK_USER,
      });
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([MOCK_SESSION_ROW]),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.insert.mockReturnValue(insertChain);

      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "Password123" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as AuthSuccessBody;
      expect(body.data.session.refreshToken).toBeDefined();
      expect(body.data.session.refreshToken).not.toBe(MOCK_SESSION_ID);
    });

    it("サインイン時のrefreshTokenとtokenが異なる値であること", async () => {
      // Arrange
      mockAuth.api.signInEmail.mockResolvedValue({
        token: MOCK_TOKEN,
        user: MOCK_USER,
      });
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([MOCK_SESSION_ROW]),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.insert.mockReturnValue(insertChain);

      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "Password123" }),
      });

      // Assert
      const body = (await res.json()) as AuthSuccessBody;
      expect(body.data.session.token).not.toBe(body.data.session.refreshToken);
    });
  });

  describe("異常系", () => {
    it("メールアドレスが不正な場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid-email", password: "Password123" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("パスワードが空の場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("認証情報が不正な場合401が返ること", async () => {
      // Arrange
      mockAuth.api.signInEmail.mockResolvedValue(null);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "wrongpassword" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_INVALID");
    });

    it("Better Auth がエラーをスローした場合401が返ること", async () => {
      // Arrange
      mockAuth.api.signInEmail.mockRejectedValue(new Error("認証エラー"));
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", password: "Password123" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_INVALID");
    });
  });
});

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("有効なトークンでセッションを取得できること", async () => {
      // Arrange
      mockAuth.api.getSession.mockResolvedValue({
        user: MOCK_USER,
        session: { token: MOCK_TOKEN, expiresAt: new Date(Date.now() + 86400000) },
      });
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/session", {
        method: "GET",
        headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as AuthSuccessBody;
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("test@example.com");
      expect(body.data.session.token).toBe(MOCK_TOKEN);
    });
  });

  describe("異常系", () => {
    it("Authorizationヘッダーがない場合401が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/session", { method: "GET" });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("セッションが存在しない場合401が返ること", async () => {
      // Arrange
      mockAuth.api.getSession.mockResolvedValue(null);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/session", {
        method: "GET",
        headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("getSession がエラーをスローした場合500が返ること", async () => {
      // Arrange
      mockAuth.api.getSession.mockRejectedValue(new Error("DBエラー"));
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/session", {
        method: "GET",
        headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
      });

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });
  });
});

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("有効なリフレッシュトークンで新しいアクセストークンを取得できること", async () => {
      // Arrange
      const refreshTokenRow = {
        id: MOCK_REFRESH_TOKEN_ID,
        sessionId: MOCK_SESSION_ID,
        userId: MOCK_USER.id,
        tokenHash: "hashed-refresh-token",
        expiresAt: MOCK_SESSION_ROW.expiresAt,
        createdAt: "2024-01-15T00:00:00.000Z",
        updatedAt: "2024-01-15T00:00:00.000Z",
      };
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([refreshTokenRow]),
      };
      const selectChain2 = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([MOCK_SESSION_ROW]),
      };
      const selectChain3 = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([MOCK_USER]),
      };
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.select
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(selectChain2)
        .mockReturnValueOnce(selectChain3);
      mockDb.update.mockReturnValue(updateChain);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: MOCK_REFRESH_TOKEN }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as RefreshSuccessBody;
      expect(body.success).toBe(true);
      expect(body.data.token).toBe(MOCK_TOKEN);
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.refreshToken).not.toBe(MOCK_REFRESH_TOKEN);
    });

    it("リフレッシュ成功時にレスポンスのtokenがセッションのアクセストークンであること", async () => {
      // Arrange
      const refreshTokenRow = {
        id: MOCK_REFRESH_TOKEN_ID,
        sessionId: MOCK_SESSION_ID,
        userId: MOCK_USER.id,
        tokenHash: "hashed-refresh-token",
        expiresAt: MOCK_SESSION_ROW.expiresAt,
        createdAt: "2024-01-15T00:00:00.000Z",
        updatedAt: "2024-01-15T00:00:00.000Z",
      };
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([refreshTokenRow]),
      };
      const selectChain2 = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([MOCK_SESSION_ROW]),
      };
      const selectChain3 = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([MOCK_USER]),
      };
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.select
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(selectChain2)
        .mockReturnValueOnce(selectChain3);
      mockDb.update.mockReturnValue(updateChain);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: MOCK_REFRESH_TOKEN }),
      });

      // Assert
      const body = (await res.json()) as RefreshSuccessBody;
      expect(body.data.token).toBe(MOCK_TOKEN);
      expect(body.data.token).not.toBe(MOCK_SESSION_ID);
    });
  });

  describe("異常系", () => {
    it("リフレッシュトークンが空の場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("セッションが存在しない場合401が返ること", async () => {
      // Arrange
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "invalid-session-id" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_EXPIRED");
    });

    it("セッションの有効期限が切れている場合401が返ること", async () => {
      // Arrange
      const expiredSession = {
        ...MOCK_SESSION_ROW,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: MOCK_REFRESH_TOKEN_ID,
            sessionId: MOCK_SESSION_ID,
            userId: MOCK_USER.id,
            tokenHash: "hashed-refresh-token",
            expiresAt: expiredSession.expiresAt,
            createdAt: "2024-01-15T00:00:00.000Z",
            updatedAt: "2024-01-15T00:00:00.000Z",
          },
        ]),
      };
      const selectChain2 = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([expiredSession]),
      };
      mockDb.select.mockReturnValueOnce(selectChain).mockReturnValueOnce(selectChain2);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: MOCK_REFRESH_TOKEN }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_EXPIRED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "invalid-session-id" }),
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toContain("セッション");
    });
  });
});
