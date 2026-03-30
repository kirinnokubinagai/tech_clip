import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { createNotificationSettingsRoute } from "./notification-settings";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
};

/** テスト用のデフォルト通知設定 */
const MOCK_SETTINGS = {
  id: "ns_01HXYZ",
  userId: MOCK_USER.id,
  newArticle: true,
  aiComplete: true,
  follow: true,
  system: true,
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

/** 成功レスポンスの型定義 */
type SettingsResponseBody = {
  success: boolean;
  data?: Record<string, unknown>;
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

/** モックのDB操作 */
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

const mockInsertValues = vi.fn();
const mockInsertOnConflict = vi.fn();
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

/**
 * 認証済みテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createTestApp() {
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

  const route = createNotificationSettingsRoute({ db: mockDb as never });
  app.route("/api/users/me", route);

  return app;
}

/**
 * 未認証テスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createTestAppWithoutAuth() {
  const app = new Hono();
  const route = createNotificationSettingsRoute({ db: mockDb as never });
  app.route("/api/users/me", route);
  return app;
}

describe("GET /api/users/me/notification-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWhere.mockResolvedValue([MOCK_SETTINGS]);
  });

  describe("正常系", () => {
    it("認証済みユーザーが通知設定を取得できること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        newArticle: true,
        aiComplete: true,
        follow: true,
        system: true,
      });
    });

    it("設定が存在しない場合デフォルト値で返すこと", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([]);
      mockInsertValues.mockReturnValue({
        onConflictDoNothing: mockInsertOnConflict,
      });
      mockInsertOnConflict.mockReturnValue({
        returning: mockInsertReturning,
      });
      mockInsertReturning.mockResolvedValue([MOCK_SETTINGS]);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        newArticle: true,
        aiComplete: true,
        follow: true,
        system: true,
      });
    });

    it("レスポンスにuserIdが含まれないこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings");

      // Assert
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.data).not.toHaveProperty("userId");
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/users/me/notification-settings");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("未認証エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/users/me/notification-settings");

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("ログインが必要です");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings");

      // Assert
      const body = (await res.json()) as SettingsResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});

describe("PATCH /api/users/me/notification-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWhere.mockResolvedValue([MOCK_SETTINGS]);
    mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere,
    });
    mockUpdateWhere.mockReturnValue({
      returning: mockUpdateReturning,
    });
    mockUpdateReturning.mockResolvedValue([{ ...MOCK_SETTINGS, newArticle: false }]);
  });

  describe("正常系", () => {
    it("newArticleをOFFにできること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newArticle: false }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ newArticle: false });
    });

    it("aiCompleteをOFFにできること", async () => {
      // Arrange
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_SETTINGS, aiComplete: false }]);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiComplete: false }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ aiComplete: false });
    });

    it("followをOFFにできること", async () => {
      // Arrange
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_SETTINGS, follow: false }]);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow: false }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ follow: false });
    });

    it("systemをOFFにできること", async () => {
      // Arrange
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_SETTINGS, system: false }]);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: false }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ system: false });
    });

    it("複数の設定を同時に更新できること", async () => {
      // Arrange
      mockUpdateReturning.mockResolvedValue([
        { ...MOCK_SETTINGS, newArticle: false, aiComplete: false },
      ]);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newArticle: false, aiComplete: false }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ newArticle: false, aiComplete: false });
    });

    it("設定が存在しない場合は作成してから更新すること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([]);
      mockInsertValues.mockReturnValue({
        onConflictDoNothing: mockInsertOnConflict,
      });
      mockInsertOnConflict.mockReturnValue({
        returning: mockInsertReturning,
      });
      mockInsertReturning.mockResolvedValue([MOCK_SETTINGS]);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newArticle: false }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SettingsResponseBody;
      expect(body.success).toBe(true);
    });
  });

  describe("バリデーション", () => {
    it("boolean以外の値を渡した場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newArticle: "yes" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("未知のフィールドを渡した場合は無視されること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unknownField: true, newArticle: false }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("空のボディの場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("バリデーションエラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("入力内容を確認してください");
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newArticle: false }),
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
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newArticle: false }),
      });

      // Assert
      const body = (await res.json()) as SettingsResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("エラーレスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });
  });
});
