import { createNotificationSettingsRoute } from "@api/routes/notification-settings";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_notif_settings_01",
  email: "notif_settings@example.com",
  name: "通知設定テストユーザー",
};

/** テスト用通知設定データ */
const MOCK_NOTIFICATION_SETTINGS = {
  id: "notif_settings_001",
  userId: MOCK_USER.id,
  newArticle: true,
  aiComplete: true,
  follow: false,
  system: true,
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

/** 通知設定レスポンスの型定義 */
type NotificationSettingsResponse = {
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
 * @returns モックDBオブジェクト
 */
function createMockDb() {
  const mockReturning = vi.fn().mockResolvedValue([MOCK_NOTIFICATION_SETTINGS]);
  const whereResult = {
    returning: mockReturning,
    // biome-ignore lint/suspicious/noThenProperty: テストモックのthenable実装
    then: (resolve: (v: unknown[]) => unknown) =>
      Promise.resolve([MOCK_NOTIFICATION_SETTINGS]).then(resolve),
  };
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue(whereResult),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: mockReturning,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
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
  const route = createNotificationSettingsRoute({
    db: mockDb as unknown as Parameters<typeof createNotificationSettingsRoute>[0]["db"],
  });

  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  app.use("*", async (c, next) => {
    if (authenticated) {
      c.set("user", MOCK_USER);
    }
    await next();
  });

  app.route("/api/users/me", route);
  return app;
}

describe("通知設定API 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe("GET /api/users/me/notification-settings", () => {
    it("認証済みユーザーが通知設定を取得できること", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/api/users/me/notification-settings");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as NotificationSettingsResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/api/users/me/notification-settings");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("レスポンスにuserIdが含まれないこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/api/users/me/notification-settings");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as NotificationSettingsResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.data).not.toHaveProperty("userId");
    });
  });

  describe("PATCH /api/users/me/notification-settings", () => {
    it("通知設定を更新できること", async () => {
      // Arrange
      const updatedSettings = { ...MOCK_NOTIFICATION_SETTINGS, follow: true };
      const mockReturningForUpdate = vi.fn().mockResolvedValue([updatedSettings]);
      mockDb.where.mockReturnValue({
        returning: mockReturningForUpdate,
        // biome-ignore lint/suspicious/noThenProperty: テストモックのthenable実装
        then: (resolve: (v: unknown[]) => unknown) =>
          Promise.resolve([MOCK_NOTIFICATION_SETTINGS]).then(resolve),
      });
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow: true }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as NotificationSettingsResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow: true }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("更新フィールドが空の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("不正なフィールド型の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow: "not-a-boolean" }),
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
