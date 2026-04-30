import { HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_OK, HTTP_UNAUTHORIZED } from "@api/lib/http-status";
import { createFavoriteRoute } from "@api/routes/favorite";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
};

/** モック記事データ（isFavorite: false） */
const MOCK_ARTICLE_NOT_FAVORITE = {
  id: "article_001",
  userId: MOCK_USER.id,
  url: "https://zenn.dev/test/articles/test-article",
  source: "zenn",
  title: "テスト記事 1",
  author: "著者 1",
  content: "記事本文 1",
  excerpt: "概要 1",
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: false,
  publishedAt: new Date("2024-01-25"),
  createdAt: new Date("2024-01-25"),
  updatedAt: new Date("2024-01-25"),
};

/** モック記事データ（isFavorite: true） */
const MOCK_ARTICLE_FAVORITE = {
  ...MOCK_ARTICLE_NOT_FAVORITE,
  isFavorite: true,
};

/** 他ユーザーの記事データ */
const MOCK_OTHER_USER_ARTICLE = {
  ...MOCK_ARTICLE_NOT_FAVORITE,
  id: "article_other_001",
  userId: "other_user_01",
};

/** モックの db.select クエリ結果 */
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

/** モックの db.update クエリ結果 */
const mockUpdateSetWhere = vi.fn();
const mockUpdateSet = vi.fn().mockReturnValue({
  where: mockUpdateSetWhere,
});
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

/** レスポンスボディ型 */
type FavoriteResponseBody = {
  success: boolean;
  data?: {
    id: string;
    isFavorite: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
};

/**
 * 認証ありのテスト用Honoアプリを作成する
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

  const favoriteRoute = createFavoriteRoute({
    db: mockDb as never,
  });
  app.route("/api/articles", favoriteRoute);

  return app;
}

/**
 * 認証なしのテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証なし）
 */
function createTestAppWithoutAuth() {
  const app = new Hono();

  const favoriteRoute = createFavoriteRoute({
    db: mockDb as never,
  });
  app.route("/api/articles", favoriteRoute);

  return app;
}

describe("POST /api/articles/:id/favorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証チェック", () => {
    it("未認証の場合401エラーになること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/articles/article_001/favorite", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as FavoriteResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("AUTH_REQUIRED");
      expect(body.error?.message).toBe("ログインが必要です");
    });
  });

  describe("記事存在チェック", () => {
    it("存在しない記事の場合404エラーになること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([]);

      // Act
      const res = await app.request("/api/articles/nonexistent/favorite", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as FavoriteResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("NOT_FOUND");
      expect(body.error?.message).toBe("記事が見つかりません");
    });
  });

  describe("所有者チェック", () => {
    it("他ユーザーの記事の場合403エラーになること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([MOCK_OTHER_USER_ARTICLE]);

      // Act
      const res = await app.request("/api/articles/article_other_001/favorite", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      const body = (await res.json()) as FavoriteResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("FORBIDDEN");
      expect(body.error?.message).toBe("この操作を実行する権限がありません");
    });
  });

  describe("お気に入りトグル", () => {
    it("isFavoriteがfalseの場合trueにトグルされること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE_NOT_FAVORITE]);
      mockUpdateSetWhere.mockResolvedValueOnce(undefined);

      // Act
      const res = await app.request("/api/articles/article_001/favorite", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FavoriteResponseBody;
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe("article_001");
      expect(body.data?.isFavorite).toBe(true);
    });

    it("isFavoriteがtrueの場合falseにトグルされること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE_FAVORITE]);
      mockUpdateSetWhere.mockResolvedValueOnce(undefined);

      // Act
      const res = await app.request("/api/articles/article_001/favorite", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FavoriteResponseBody;
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe("article_001");
      expect(body.data?.isFavorite).toBe(false);
    });

    it("db.updateが正しい値で呼び出されること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE_NOT_FAVORITE]);
      mockUpdateSetWhere.mockResolvedValueOnce(undefined);

      // Act
      await app.request("/api/articles/article_001/favorite", {
        method: "POST",
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isFavorite: true,
        }),
      );
    });
  });
});
