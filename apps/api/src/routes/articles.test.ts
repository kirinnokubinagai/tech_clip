import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticlesQueryFn } from "./articles";
import { createArticlesRoute } from "./articles";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
};

/** テスト用の記事データ */
const MOCK_ARTICLES = Array.from({ length: 25 }, (_, i) => ({
  id: `article_${String(i + 1).padStart(3, "0")}`,
  userId: MOCK_USER.id,
  url: `https://example.com/article-${i + 1}`,
  source: i % 2 === 0 ? "zenn" : "qiita",
  title: `テスト記事 ${i + 1}`,
  author: `著者 ${i + 1}`,
  content: `記事本文 ${i + 1}`,
  excerpt: `概要 ${i + 1}`,
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: i < 10,
  isFavorite: i < 5,
  isPublic: false,
  publishedAt: new Date(`2024-01-${String(25 - i).padStart(2, "0")}`),
  createdAt: new Date(`2024-01-${String(25 - i).padStart(2, "0")}`),
  updatedAt: new Date(`2024-01-${String(25 - i).padStart(2, "0")}`),
}));

/** レスポンスの型定義 */
type ArticlesResponseBody = {
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

type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** モックDBクエリ関数の型 */
type MockQueryFn = ReturnType<typeof vi.fn<ArticlesQueryFn>>;

/**
 * テスト用Honoアプリを作成する
 *
 * @param mockQueryFn - 記事一覧クエリのモック関数
 * @returns テスト用Honoアプリ
 */
function createTestApp(mockQueryFn: MockQueryFn) {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("/api/articles", (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const articlesRoute = createArticlesRoute(mockQueryFn);
  app.route("/api", articlesRoute);

  return app;
}

/**
 * 認証なしのテスト用Honoアプリを作成する
 *
 * @param mockQueryFn - 記事一覧クエリのモック関数
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createTestAppWithoutAuth(mockQueryFn: MockQueryFn) {
  const app = new Hono();

  const articlesRoute = createArticlesRoute(mockQueryFn);
  app.route("/api", articlesRoute);

  return app;
}

describe("GET /api/articles", () => {
  let mockQueryFn: MockQueryFn;

  beforeEach(() => {
    mockQueryFn = vi.fn<ArticlesQueryFn>();
  });

  describe("認証", () => {
    it("認証済みユーザーが記事一覧を取得できること", async () => {
      // Arrange
      const articles = MOCK_ARTICLES.slice(0, 20);
      mockQueryFn.mockResolvedValue(articles.concat([MOCK_ARTICLES[20]]));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(20);
    });

    it("未認証の場合401が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestAppWithoutAuth(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("ページネーション", () => {
    it("デフォルトで20件の記事を返すこと", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.data).toHaveLength(20);
    });

    it("limit パラメータで取得件数を変更できること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 11));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?limit=10");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.data).toHaveLength(10);
    });

    it("次のページがある場合hasNextがtrueであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).not.toBeNull();
    });

    it("次のページがない場合hasNextがfalseであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 5));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });

    it("cursorパラメータで次ページを取得できること", async () => {
      // Arrange
      const nextPageArticles = MOCK_ARTICLES.slice(20, 25);
      mockQueryFn.mockResolvedValue(nextPageArticles);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?cursor=article_020");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.data).toHaveLength(5);
      expect(body.meta.hasNext).toBe(false);
    });

    it("nextCursorが最後の記事のIDであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      const body = (await res.json()) as ArticlesResponseBody;
      const lastArticle = body.data[body.data.length - 1];
      expect(body.meta.nextCursor).toBe(lastArticle.id);
    });
  });

  describe("フィルタリング", () => {
    it("source パラメータでフィルタリングできること", async () => {
      // Arrange
      const zennArticles = MOCK_ARTICLES.filter((a) => a.source === "zenn");
      mockQueryFn.mockResolvedValue(zennArticles);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?source=zenn");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ source: "zenn" }));
    });

    it("isFavorite パラメータでフィルタリングできること", async () => {
      // Arrange
      const favoriteArticles = MOCK_ARTICLES.filter((a) => a.isFavorite);
      mockQueryFn.mockResolvedValue(favoriteArticles);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?isFavorite=true");

      // Assert
      expect(res.status).toBe(200);
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ isFavorite: true }));
    });

    it("isRead パラメータでフィルタリングできること", async () => {
      // Arrange
      const readArticles = MOCK_ARTICLES.filter((a) => a.isRead);
      mockQueryFn.mockResolvedValue(readArticles);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?isRead=true");

      // Assert
      expect(res.status).toBe(200);
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ isRead: true }));
    });

    it("複数のフィルターを組み合わせて使用できること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?source=zenn&isFavorite=true&isRead=false");

      // Assert
      expect(res.status).toBe(200);
      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "zenn",
          isFavorite: true,
          isRead: false,
        }),
      );
    });
  });

  describe("バリデーション", () => {
    it("limitが1未満の場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?limit=0");

      // Assert
      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが50を超える場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?limit=51");

      // Assert
      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが数値でない場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?limit=abc");

      // Assert
      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("isFavoriteがtrue/false以外の場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?isFavorite=invalid");

      // Assert
      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("isReadがtrue/false以外の場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?isRead=invalid");

      // Assert
      expect(res.status).toBe(422);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 3));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("nextCursor");
      expect(body.meta).toHaveProperty("hasNext");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("記事データにcontentフィールドが含まれないこと", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 1));
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.data[0]).not.toHaveProperty("content");
    });

    it("空の配列が返る場合も正常なレスポンス形式であること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
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
      const app = createTestApp(mockQueryFn);

      // Act
      await app.request("/api/articles");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ userId: MOCK_USER.id }));
    });

    it("limitがクエリ関数に渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      await app.request("/api/articles?limit=15");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ limit: 16 }));
    });

    it("cursorがクエリ関数に渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      await app.request("/api/articles?cursor=article_010");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ cursor: "article_010" }));
    });

    it("フィルター未指定時はundefinedが渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn);

      // Act
      await app.request("/api/articles");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          source: undefined,
          isFavorite: undefined,
          isRead: undefined,
        }),
      );
    });
  });
});
