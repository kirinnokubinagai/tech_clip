import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationsQueryFn } from "../../../apps/api/src/routes/notifications";
import { createNotificationsRoute } from "../../../apps/api/src/routes/notifications";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_UNAUTHORIZED = 401;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_notif_01",
  email: "notif@example.com",
  name: "通知テストユーザー",
};

/** テスト用通知データ */
const MOCK_NOTIFICATIONS = [
  {
    id: "notif_001",
    userId: MOCK_USER.id,
    type: "follow",
    isRead: false,
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "notif_002",
    userId: MOCK_USER.id,
    type: "ai_complete",
    isRead: true,
    createdAt: new Date("2024-01-02"),
  },
];

/** エラーレスポンスの型定義 */
type ErrorResponse = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** 通知一覧レスポンスの型定義 */
type NotificationsListResponse = {
  success: boolean;
  data: Array<Record<string, unknown>>;
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
};

/** 通知レスポンスの型定義 */
type NotificationResponse = {
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
  const mockReturning = vi.fn().mockResolvedValue([]);
  const whereResult = {
    returning: mockReturning,
    // biome-ignore lint/suspicious/noThenProperty: テストモックのthenable実装
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
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
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
  };
}

/**
 * テスト用アプリを生成する
 *
 * @param mockDb - モックDBオブジェクト
 * @param mockQueryFn - モッククエリ関数
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(
  mockDb: ReturnType<typeof createMockDb>,
  mockQueryFn: ReturnType<typeof vi.fn<NotificationsQueryFn>>,
  authenticated = true,
) {
  const route = createNotificationsRoute({
    db: mockDb as unknown as Parameters<typeof createNotificationsRoute>[0]["db"],
    queryFn: mockQueryFn,
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

describe("通知API 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockQueryFn: ReturnType<typeof vi.fn<NotificationsQueryFn>>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockQueryFn = vi.fn<NotificationsQueryFn>().mockResolvedValue(MOCK_NOTIFICATIONS);
  });

  describe("GET /notifications", () => {
    it("認証済みユーザーが通知一覧を取得できること", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/notifications");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as NotificationsListResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/notifications");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("limitパラメータが不正な場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/notifications?limit=abc");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("POST /register", () => {
    it("プッシュトークンを登録できること", async () => {
      // Arrange
      mockDb.returning.mockResolvedValue([{ id: "push_token_001" }]);
      const app = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "ExponentPushToken[xxx]", platform: "ios" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as NotificationResponse;

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "ExponentPushToken[xxx]", platform: "ios" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("platformが不正な場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "ExponentPushToken[xxx]", platform: "windows" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("tokenが空の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "", platform: "ios" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("PATCH /:id/read", () => {
    it("通知を既読にできること", async () => {
      // Arrange
      const updatedNotification = { ...MOCK_NOTIFICATIONS[0], isRead: true };
      const mockReturningForUpdate = vi.fn().mockResolvedValue([updatedNotification]);
      mockDb.where.mockReturnValue({
        returning: mockReturningForUpdate,
        // biome-ignore lint/suspicious/noThenProperty: テストモックのthenable実装
        then: (resolve: (v: unknown[]) => unknown) =>
          Promise.resolve([MOCK_NOTIFICATIONS[0]]).then(resolve),
      });
      const app = createTestApp(mockDb, mockQueryFn);
      const req = new Request(`http://localhost/${MOCK_NOTIFICATIONS[0].id}/read`, {
        method: "PATCH",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as NotificationResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/notif_001/read", {
        method: "PATCH",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });
});
