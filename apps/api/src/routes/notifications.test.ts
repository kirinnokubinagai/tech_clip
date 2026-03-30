import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTTP_CREATED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import type { NotificationsQueryFn } from "./notifications";
import { createNotificationsRoute } from "./notifications";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
};

/** テスト用の通知データ */
const MOCK_NOTIFICATIONS = Array.from({ length: 25 }, (_, i) => ({
  id: `notif_${String(i + 1).padStart(3, "0")}`,
  userId: MOCK_USER.id,
  type: i % 2 === 0 ? "new_article" : "follow",
  title: `通知タイトル ${i + 1}`,
  body: `通知本文 ${i + 1}`,
  isRead: i < 10,
  data: null,
  createdAt: `2024-01-${String(25 - i).padStart(2, "0")}T00:00:00Z`,
}));

/** GET レスポンスの型定義 */
type NotificationsResponseBody = {
  success: boolean;
  data: Array<Record<string, unknown>>;
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** POST /register レスポンスの型定義 */
type RegisterResponseBody = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** PATCH /:id/read レスポンスの型定義 */
type ReadResponseBody = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** モックQueryFnの型 */
type MockQueryFn = ReturnType<typeof vi.fn<NotificationsQueryFn>>;

/** モックのDB操作 */
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockInsertOnConflict = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

/** モックのDBインスタンス */
const mockDb = {
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
};

/**
 * GET テスト用Honoアプリを作成する
 *
 * @param mockQueryFn - 通知一覧クエリのモック関数
 * @returns テスト用Honoアプリ
 */
function createGetTestApp(mockQueryFn: MockQueryFn) {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("/api/notifications", (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const notificationsRoute = createNotificationsRoute({
    db: mockDb as never,
    queryFn: mockQueryFn,
  });
  app.route("/api", notificationsRoute);

  return app;
}

/**
 * 認証なしのGETテスト用Honoアプリを作成する
 *
 * @param mockQueryFn - 通知一覧クエリのモック関数
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createGetTestAppWithoutAuth(mockQueryFn: MockQueryFn) {
  const app = new Hono();

  const notificationsRoute = createNotificationsRoute({
    db: mockDb as never,
    queryFn: mockQueryFn,
  });
  app.route("/api", notificationsRoute);

  return app;
}

/**
 * POST/PATCH テスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createMutationTestApp() {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    await next();
  });

  const mockQueryFn = vi.fn<NotificationsQueryFn>().mockResolvedValue([]);
  const notificationsRoute = createNotificationsRoute({
    db: mockDb as never,
    queryFn: mockQueryFn,
  });
  app.route("/api/notifications", notificationsRoute);

  return app;
}

/**
 * 未認証のPOST/PATCHテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createMutationTestAppWithoutAuth() {
  const app = new Hono();

  const mockQueryFn = vi.fn<NotificationsQueryFn>().mockResolvedValue([]);
  const notificationsRoute = createNotificationsRoute({
    db: mockDb as never,
    queryFn: mockQueryFn,
  });
  app.route("/api/notifications", notificationsRoute);

  return app;
}

describe("GET /api/notifications", () => {
  let mockQueryFn: MockQueryFn;

  beforeEach(() => {
    mockQueryFn = vi.fn<NotificationsQueryFn>();
  });

  describe("認証", () => {
    it("認証済みユーザーが通知一覧を取得できること", async () => {
      // Arrange
      const fetchedNotifications = MOCK_NOTIFICATIONS.slice(0, 20);
      mockQueryFn.mockResolvedValue(fetchedNotifications.concat([MOCK_NOTIFICATIONS[20]]));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(20);
    });

    it("未認証の場合401が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestAppWithoutAuth(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("ページネーション", () => {
    it("デフォルトで20件の通知を返すこと", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_NOTIFICATIONS.slice(0, 21));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body.data).toHaveLength(20);
    });

    it("limitパラメータで取得件数を変更できること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_NOTIFICATIONS.slice(0, 11));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications?limit=10");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body.data).toHaveLength(10);
    });

    it("次のページがある場合hasNextがtrueであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_NOTIFICATIONS.slice(0, 21));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).not.toBeNull();
    });

    it("次のページがない場合hasNextがfalseであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_NOTIFICATIONS.slice(0, 5));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });

    it("cursorパラメータで次ページを取得できること", async () => {
      // Arrange
      const nextPageNotifications = MOCK_NOTIFICATIONS.slice(20, 25);
      mockQueryFn.mockResolvedValue(nextPageNotifications);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications?cursor=notif_020");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body.data).toHaveLength(5);
      expect(body.meta.hasNext).toBe(false);
    });

    it("nextCursorが最後の通知のIDであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_NOTIFICATIONS.slice(0, 21));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      const body = (await res.json()) as NotificationsResponseBody;
      const lastNotification = body.data[body.data.length - 1];
      expect(body.meta.nextCursor).toBe(lastNotification.id);
    });
  });

  describe("バリデーション", () => {
    it("limitが1未満の場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications?limit=0");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが50を超える場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications?limit=51");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが数値でない場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications?limit=abc");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_NOTIFICATIONS.slice(0, 3));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("nextCursor");
      expect(body.meta).toHaveProperty("hasNext");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("空の配列が返る場合も正常なレスポンス形式であること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/notifications");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as NotificationsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });
  });

  describe("クエリ関数への引数", () => {
    it("userIdがクエリ関数に渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      await app.request("/api/notifications");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ userId: MOCK_USER.id }));
    });

    it("limitがクエリ関数に渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      await app.request("/api/notifications?limit=15");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ limit: 16 }));
    });

    it("cursorがクエリ関数に渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      await app.request("/api/notifications?cursor=notif_010");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ cursor: "notif_010" }));
    });
  });
});

describe("POST /api/notifications/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockReturnValue({
      onConflictDoUpdate: mockInsertOnConflict,
    });
    mockInsertOnConflict.mockReturnValue({
      returning: mockInsertReturning,
    });
  });

  describe("正常系", () => {
    it("有効なプッシュトークンを登録して201を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockInsertReturning.mockResolvedValue([
        {
          id: "token_01",
          userId: MOCK_USER.id,
          token: "ExponentPushToken[xxxxxx]",
          platform: "ios",
          createdAt: "2024-01-15T00:00:00Z",
          updatedAt: "2024-01-15T00:00:00Z",
        },
      ]);

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "ExponentPushToken[xxxxxx]",
          platform: "ios",
        }),
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as RegisterResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        token: "ExponentPushToken[xxxxxx]",
        platform: "ios",
      });
    });

    it("androidプラットフォームでも登録できること", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockInsertReturning.mockResolvedValue([
        {
          id: "token_02",
          userId: MOCK_USER.id,
          token: "fcm-token-android",
          platform: "android",
          createdAt: "2024-01-15T00:00:00Z",
          updatedAt: "2024-01-15T00:00:00Z",
        },
      ]);

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "fcm-token-android",
          platform: "android",
        }),
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as RegisterResponseBody;
      expect(body.success).toBe(true);
    });
  });

  describe("バリデーションエラー", () => {
    it("tokenが未指定の場合422を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "ios" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as RegisterResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("platformが未指定の場合422を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "ExponentPushToken[xxxxxx]" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as RegisterResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("platformがios/android以外の場合422を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "ExponentPushToken[xxxxxx]",
          platform: "windows",
        }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as RegisterResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("tokenが空文字の場合422を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "", platform: "ios" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as RegisterResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      const body = (await res.json()) as RegisterResponseBody;
      expect(body.error?.message).toBe("入力内容を確認してください");
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createMutationTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "ExponentPushToken[xxxxxx]",
          platform: "ios",
        }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockInsertReturning.mockResolvedValue([
        {
          id: "token_01",
          userId: MOCK_USER.id,
          token: "ExponentPushToken[xxxxxx]",
          platform: "ios",
          createdAt: "2024-01-15T00:00:00Z",
          updatedAt: "2024-01-15T00:00:00Z",
        },
      ]);

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "ExponentPushToken[xxxxxx]",
          platform: "ios",
        }),
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as RegisterResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("エラーレスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      const res = await app.request("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      const body = (await res.json()) as RegisterResponseBody;
      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });
  });
});

describe("PATCH /api/notifications/:id/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWhere.mockResolvedValue([]);
    mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere,
    });
    mockUpdateWhere.mockReturnValue({
      returning: mockUpdateReturning,
    });
  });

  describe("正常系", () => {
    it("通知を既読にして200を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockSelectWhere.mockResolvedValue([
        {
          id: "notif_001",
          userId: MOCK_USER.id,
          type: "new_article",
          title: "通知タイトル",
          body: "通知本文",
          isRead: false,
          data: null,
          createdAt: "2024-01-15T00:00:00Z",
        },
      ]);
      mockUpdateReturning.mockResolvedValue([
        {
          id: "notif_001",
          userId: MOCK_USER.id,
          type: "new_article",
          title: "通知タイトル",
          body: "通知本文",
          isRead: true,
          data: null,
          createdAt: "2024-01-15T00:00:00Z",
        },
      ]);

      // Act
      const res = await app.request("/api/notifications/notif_001/read", {
        method: "PATCH",
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ReadResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: "notif_001",
        isRead: true,
      });
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createMutationTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/notifications/notif_001/read", {
        method: "PATCH",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("存在しない通知", () => {
    it("通知が存在しない場合404が返ること", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/notifications/notif_nonexistent/read", {
        method: "PATCH",
      });

      // Assert
      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("他ユーザーの通知の場合404が返ること", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockSelectWhere.mockResolvedValue([
        {
          id: "notif_other",
          userId: "other_user_id",
          type: "new_article",
          title: "他ユーザーの通知",
          body: "本文",
          isRead: false,
          data: null,
          createdAt: "2024-01-15T00:00:00Z",
        },
      ]);

      // Act
      const res = await app.request("/api/notifications/notif_other/read", {
        method: "PATCH",
      });

      // Assert
      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockSelectWhere.mockResolvedValue([
        {
          id: "notif_001",
          userId: MOCK_USER.id,
          type: "new_article",
          title: "通知タイトル",
          body: "通知本文",
          isRead: false,
          data: null,
          createdAt: "2024-01-15T00:00:00Z",
        },
      ]);
      mockUpdateReturning.mockResolvedValue([
        {
          id: "notif_001",
          userId: MOCK_USER.id,
          type: "new_article",
          title: "通知タイトル",
          body: "通知本文",
          isRead: true,
          data: null,
          createdAt: "2024-01-15T00:00:00Z",
        },
      ]);

      // Act
      const res = await app.request("/api/notifications/notif_001/read", {
        method: "PATCH",
      });

      // Assert
      const body = (await res.json()) as ReadResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/notifications/notif_nonexistent/read", {
        method: "PATCH",
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("通知が見つかりません");
    });
  });
});

/** GET /api/notifications/unread-count レスポンスの型定義 */
type UnreadCountResponseBody = {
  success: boolean;
  data?: { count: number };
  error?: {
    code: string;
    message: string;
  };
};

describe("GET /api/notifications/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("未読通知数を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockSelectWhere.mockResolvedValue([{ count: 3 }]);

      // Act
      const res = await app.request("/api/notifications/unread-count");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UnreadCountResponseBody;
      expect(body.success).toBe(true);
      expect(body.data?.count).toBe(3);
    });

    it("未読通知がない場合0を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockSelectWhere.mockResolvedValue([{ count: 0 }]);

      // Act
      const res = await app.request("/api/notifications/unread-count");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UnreadCountResponseBody;
      expect(body.success).toBe(true);
      expect(body.data?.count).toBe(0);
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createMutationTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/notifications/unread-count");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });
});

/** PATCH /api/notifications/read-all レスポンスの型定義 */
type ReadAllResponseBody = {
  success: boolean;
  data?: null;
  error?: {
    code: string;
    message: string;
  };
};

describe("PATCH /api/notifications/read-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere,
    });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  describe("正常系", () => {
    it("全通知を既読にして200を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      const res = await app.request("/api/notifications/read-all", {
        method: "PATCH",
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ReadAllResponseBody;
      expect(body.success).toBe(true);
    });

    it("updateが正しいパラメータで呼ばれること", async () => {
      // Arrange
      const app = createMutationTestApp();

      // Act
      await app.request("/api/notifications/read-all", {
        method: "PATCH",
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith(expect.anything());
      expect(mockUpdateSet).toHaveBeenCalledWith({ isRead: true });
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createMutationTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/notifications/read-all", {
        method: "PATCH",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("エラーハンドリング", () => {
    it("DB更新失敗時に500を返すこと", async () => {
      // Arrange
      const app = createMutationTestApp();
      mockUpdateWhere.mockRejectedValue(new Error("DB error"));

      // Act
      const res = await app.request("/api/notifications/read-all", {
        method: "PATCH",
      });

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      const body = (await res.json()) as ReadAllResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.message).toBe("通知の更新に失敗しました");
    });
  });
});
