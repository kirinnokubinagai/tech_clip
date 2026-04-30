import type { ArticlesQueryFn } from "@api/routes/articles";
import { createArticlesRoute } from "@api/routes/articles";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_integration_01",
  email: "integration@example.com",
  name: "統合テストユーザー",
};

/** テスト用記事データ */
const MOCK_ARTICLES = Array.from({ length: 5 }, (_, i) => ({
  id: `article_integration_${String(i + 1).padStart(3, "0")}`,
  userId: MOCK_USER.id,
  url: `https://example.com/article-${i + 1}`,
  source: "zenn",
  title: `統合テスト記事 ${i + 1}`,
  author: `著者 ${i + 1}`,
  content: `記事本文 ${i + 1}`,
  excerpt: `概要 ${i + 1}`,
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: false,
  publishedAt: new Date("2024-01-01"),
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
}));

/** エラーレスポンスの型定義 */
type ErrorResponse = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** 記事一覧レスポンスの型定義 */
type ArticlesListResponse = {
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

/** 記事詳細レスポンスの型定義 */
type ArticleResponse = {
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
  const articleStore: Array<Record<string, unknown>> = [...MOCK_ARTICLES];

  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => ({
      // biome-ignore lint/suspicious/noThenProperty: テストモックのthenable実装
      then: (resolve: (val: unknown[]) => void) => resolve([]),
    })),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    _articleStore: articleStore,
  };
}

/**
 * 認証済みユーザーを持つテスト用アプリを生成する
 *
 * @param mockDb - モックDBオブジェクト
 * @param mockQueryFn - モッククエリ関数
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(
  mockDb: ReturnType<typeof createMockDb>,
  mockQueryFn: ReturnType<typeof vi.fn<ArticlesQueryFn>>,
  authenticated = true,
) {
  const mockParseArticle = vi.fn().mockResolvedValue({
    title: "テスト記事タイトル",
    author: "テスト著者",
    content: "# テスト記事\n\nこれはテスト記事です。",
    excerpt: "テスト記事の概要",
    thumbnailUrl: null,
    readingTimeMinutes: 3,
    publishedAt: "2024-01-15T00:00:00Z",
    source: "zenn",
  });

  const route = createArticlesRoute({
    db: mockDb as unknown as Parameters<typeof createArticlesRoute>[0]["db"],
    parseArticleFn: mockParseArticle,
    queryFn: mockQueryFn,
  });

  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  app.use("*", async (c, next) => {
    if (authenticated) {
      c.set("user", MOCK_USER);
    }
    await next();
  });

  app.route("/articles", route);
  return { app, mockParseArticle };
}

describe("記事API 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockQueryFn: ReturnType<typeof vi.fn<ArticlesQueryFn>>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockQueryFn = vi.fn<ArticlesQueryFn>().mockResolvedValue(MOCK_ARTICLES);
  });

  describe("GET /articles", () => {
    it("認証済みユーザーが記事一覧を取得できること", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ArticlesListResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.meta.hasNext).toBe(false);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("limitパラメータで件数を制限できること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 2));
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles?limit=2");

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
    });

    it("limitが不正な場合に422エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles?limit=abc");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが範囲外の場合に422エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles?limit=100");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("isFavoriteパラメータが不正な場合に422エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles?isFavorite=maybe");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("contentフィールドがレスポンスから除外されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 1));
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ArticlesListResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.data[0]).not.toHaveProperty("content");
    });

    it("21件以上ある場合にhasNextがtrueになること", async () => {
      // Arrange
      const manyArticles = Array.from({ length: 21 }, (_, i) => ({
        ...MOCK_ARTICLES[0],
        id: `article_many_${i}`,
      }));
      mockQueryFn.mockResolvedValue(manyArticles);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ArticlesListResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).not.toBeNull();
    });
  });

  describe("POST /", () => {
    it("有効なURLで記事を保存できること", async () => {
      // Arrange
      const newArticle = {
        id: "new_article_001",
        userId: MOCK_USER.id,
        url: "https://zenn.dev/new-article",
        title: "新しい記事",
        source: "zenn",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([]);
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([newArticle]);

      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://zenn.dev/new-article" }),
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/article" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("URLが無効な場合に422エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-valid-url" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("URLが空の場合に422エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("重複URLの場合に409エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([MOCK_ARTICLES[0]]);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: MOCK_ARTICLES[0].url }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_CONFLICT);
      expect(body.error.code).toBe("DUPLICATE");
    });

    it("parseArticleが失敗した場合に500エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);
      const { app, mockParseArticle } = createTestApp(mockDb, mockQueryFn);
      mockParseArticle.mockRejectedValue(new Error("パース失敗"));
      const req = new Request("http://localhost/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/new-article" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("GET /:id", () => {
    it("自分の記事を取得できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([MOCK_ARTICLES[0]]);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLES[0].id}`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ArticleResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe(MOCK_ARTICLES[0].id);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/articles/article_001");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しない記事の場合に404エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles/nonexistent_article");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("他ユーザーの記事にアクセスした場合に403エラーを返すこと", async () => {
      // Arrange
      const otherUserArticle = { ...MOCK_ARTICLES[0], userId: "other_user_id" };
      mockDb.where.mockResolvedValue([otherUserArticle]);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request(`http://localhost/articles/${otherUserArticle.id}`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("PATCH /:id", () => {
    it("isReadをtrueに更新できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([MOCK_ARTICLES[0]]);
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLES[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ArticleResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("フィールドが指定されていない場合に422エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles/article_001", {
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

    it("存在しない記事の場合に404エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles/nonexistent_article", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE /:id", () => {
    it("自分の記事を削除できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([MOCK_ARTICLES[0]]);
      mockDb.delete.mockReturnThis();
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLES[0].id}`, {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_NO_CONTENT);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const { app } = createTestApp(mockDb, mockQueryFn, false);
      const req = new Request("http://localhost/articles/article_001", {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しない記事の場合に404エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request("http://localhost/articles/nonexistent_article", {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("他ユーザーの記事を削除しようとした場合に403エラーを返すこと", async () => {
      // Arrange
      const otherUserArticle = { ...MOCK_ARTICLES[0], userId: "other_user_id" };
      mockDb.where.mockResolvedValue([otherUserArticle]);
      const { app } = createTestApp(mockDb, mockQueryFn);
      const req = new Request(`http://localhost/articles/${otherUserArticle.id}`, {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });
});
