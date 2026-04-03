import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUsersRoute } from "../../../apps/api/src/routes/users";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_users_01",
  email: "users@example.com",
  name: "ユーザーテスト",
  username: "test_user",
  bio: "テスト用自己紹介",
  websiteUrl: null,
  githubUsername: null,
  twitterUsername: null,
  avatarUrl: null,
  isProfilePublic: true,
  preferredLanguage: "ja",
  isPremium: false,
  premiumExpiresAt: null,
  pushToken: "secret_token",
  pushEnabled: false,
  freeAiUsesRemaining: 3,
  freeAiResetAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** エラーレスポンスの型定義 */
type ErrorResponse = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** ユーザーレスポンスの型定義 */
type UserResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
};

/**
 * テスト用モックDBを生成する
 *
 * @param userInDb - DBに存在するユーザーデータ
 * @returns モックDBオブジェクト
 */
function createMockDb(userInDb: Record<string, unknown> | null = MOCK_USER) {
  const userData = userInDb ? [userInDb] : [];
  const returning = vi.fn().mockResolvedValue(userData);
  const whereResult = {
    returning,
    // biome-ignore lint/suspicious/noThenProperty: テストモックのthenable実装
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(userData).then(resolve),
  };
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue(whereResult),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning,
  };
}

/**
 * テスト用アプリを生成する
 *
 * @param mockDb - モックDBオブジェクト
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(mockDb: ReturnType<typeof createMockDb>, authenticated = true) {
  const route = createUsersRoute({
    db: mockDb as unknown as Parameters<typeof createUsersRoute>[0]["db"],
  });

  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  app.use("*", async (c, next) => {
    if (authenticated) {
      c.set("user", MOCK_USER);
    }
    await next();
  });

  app.route("/", route);
  return app;
}

describe("ユーザーAPI 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe("GET /me", () => {
    it("認証済みユーザーが自分のプロフィールを取得できること", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/me");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as UserResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe(MOCK_USER.id);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/me");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("DBにユーザーが存在しない場合に404エラーを返すこと", async () => {
      // Arrange
      const emptyMockDb = createMockDb(null);
      const app = createTestApp(emptyMockDb);
      const req = new Request("http://localhost/me");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("機密フィールドがレスポンスから除外されること", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/me");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as UserResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.data).not.toHaveProperty("pushToken");
      expect(body.data).not.toHaveProperty("pushEnabled");
      expect(body.data).not.toHaveProperty("freeAiUsesRemaining");
    });
  });

  describe("PATCH /me", () => {
    it("プロフィールを更新できること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, name: "更新後の名前" };
      const updatedReturning = vi.fn().mockResolvedValue([updatedUser]);
      const updateWhereResult = {
        returning: updatedReturning,
        // biome-ignore lint/suspicious/noThenProperty: テストモックのthenable実装
        then: (resolve: (v: unknown) => unknown) => Promise.resolve([MOCK_USER]).then(resolve),
      };
      const updateMockDb = {
        ...mockDb,
        where: vi.fn().mockReturnValue(updateWhereResult),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        returning: updatedReturning,
      };
      const app = createTestApp(updateMockDb as unknown as ReturnType<typeof createMockDb>);
      const req = new Request("http://localhost/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "更新後の名前" }),
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "更新後の名前" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("ユーザー名が不正な形式の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "invalid username!" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });
});
