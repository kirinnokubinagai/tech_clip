import {
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NO_CONTENT,
  HTTP_UNAUTHORIZED,
} from "@api/lib/http-status";
import { createUsersRoute } from "@api/routes/users";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
  image: null,
  emailVerified: true,
  username: "testuser",
  bio: null,
  websiteUrl: null,
  githubUsername: null,
  twitterUsername: null,
  avatarUrl: null,
  isProfilePublic: true,
  preferredLanguage: "ja",
  isPremium: false,
  premiumExpiresAt: null,
  freeAiUsesRemaining: 5,
  freeAiResetAt: null,
  pushToken: null,
  pushEnabled: true,
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
};

/** モックのDBトランザクション関数 */
const mockTransactionFn = vi.fn();

/** モックのDBインスタンス */
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  transaction: mockTransactionFn,
};

/**
 * 認証済みテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createAuthenticatedTestApp() {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const usersRoute = createUsersRoute({ db: mockDb as never });
  app.route("/api/users", usersRoute);

  return app;
}

/**
 * 未認証テスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createUnauthenticatedTestApp() {
  const app = new Hono();

  const usersRoute = createUsersRoute({ db: mockDb as never });
  app.route("/api/users", usersRoute);

  return app;
}

describe("DELETE /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createUnauthenticatedTestApp();

      // Act
      const res = await app.request("/api/users/me", { method: "DELETE" });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("正常系", () => {
    it("認証済みユーザーのアカウントが削除され204が返ること", async () => {
      // Arrange
      mockTransactionFn.mockResolvedValue(undefined);
      const app = createAuthenticatedTestApp();

      // Act
      const res = await app.request("/api/users/me", { method: "DELETE" });

      // Assert
      expect(res.status).toBe(HTTP_NO_CONTENT);
    });

    it("トランザクション内でユーザー削除が実行されること", async () => {
      // Arrange
      mockTransactionFn.mockResolvedValue(undefined);
      const app = createAuthenticatedTestApp();

      // Act
      await app.request("/api/users/me", { method: "DELETE" });

      // Assert
      expect(mockTransactionFn).toHaveBeenCalledTimes(1);
    });

    it("レスポンスボディが空であること", async () => {
      // Arrange
      mockTransactionFn.mockResolvedValue(undefined);
      const app = createAuthenticatedTestApp();

      // Act
      const res = await app.request("/api/users/me", { method: "DELETE" });

      // Assert
      const text = await res.text();
      expect(text).toBe("");
    });
  });

  describe("異常系", () => {
    it("DBエラーが発生した場合500が返ること", async () => {
      // Arrange
      mockTransactionFn.mockRejectedValue(new Error("DBエラーが発生しました"));
      const app = createAuthenticatedTestApp();

      // Act
      const res = await app.request("/api/users/me", { method: "DELETE" });

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      mockTransactionFn.mockRejectedValue(new Error("DBエラー"));
      const app = createAuthenticatedTestApp();

      // Act
      const res = await app.request("/api/users/me", { method: "DELETE" });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("アカウントの削除に失敗しました");
    });
  });
});
