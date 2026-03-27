import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticlesRoute } from "./articles";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_test_01",
  email: "test@example.com",
  name: "テストユーザー",
};

/** テスト用のモックセッション */
const MOCK_SESSION = {
  id: "session_test_01",
  userId: "user_test_01",
};

/** テスト用のパース済み記事 */
const MOCK_PARSED_ARTICLE = {
  title: "テスト記事タイトル",
  author: "テスト著者",
  content: "# テスト記事\n\nこれはテスト記事です。",
  excerpt: "テスト記事の概要",
  thumbnailUrl: "https://example.com/thumb.png",
  readingTimeMinutes: 3,
  publishedAt: "2024-01-15T00:00:00Z",
  source: "zenn" as const,
};

/** HTTP 201 Created ステータスコード */
const HTTP_CREATED = 201;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 409 Conflict ステータスコード */
const HTTP_CONFLICT = 409;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** レスポンスボディの型定義 */
type ArticleResponseBody = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** モックの parseArticle 関数 */
const mockParseArticle = vi.fn();

/** モックの db.insert 結果 */
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

/** モックの db.select クエリ結果 */
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
  select: mockSelect,
};

vi.mock("../services/article-parser", () => ({
  parseArticle: (...args: unknown[]) => mockParseArticle(...args),
}));

/**
 * テスト用Honoアプリを作成する
 */
function createTestApp() {
  type Variables = {
    user: typeof MOCK_USER;
    session: typeof MOCK_SESSION;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", MOCK_SESSION);
    await next();
  });

  const articlesRoute = createArticlesRoute({
    db: mockDb as never,
    parseArticleFn: mockParseArticle,
  });
  app.route("/api/articles", articlesRoute);

  return app;
}

/**
 * テスト用の未認証Honoアプリを作成する
 */
function createUnauthenticatedTestApp() {
  const app = new Hono();

  const articlesRoute = createArticlesRoute({
    db: mockDb as never,
    parseArticleFn: mockParseArticle,
  });
  app.route("/api/articles", articlesRoute);

  return app;
}

/**
 * POST リクエストを送信するヘルパー
 */
function postArticle(app: { request: Hono["request"] }, body: Record<string, unknown>) {
  return app.request("/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/articles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWhere.mockResolvedValue([]);
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    });
  });

  describe("正常系", () => {
    it("有効なURLで記事を保存して201を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockParseArticle.mockResolvedValue(MOCK_PARSED_ARTICLE);
      mockInsertReturning.mockResolvedValue([
        {
          id: "article_test_01",
          userId: MOCK_USER.id,
          url: "https://zenn.dev/test/articles/test-article",
          ...MOCK_PARSED_ARTICLE,
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await postArticle(app, {
        url: "https://zenn.dev/test/articles/test-article",
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        url: "https://zenn.dev/test/articles/test-article",
        title: "テスト記事タイトル",
        source: "zenn",
      });
    });

    it("parseArticleに正しいURLが渡されること", async () => {
      // Arrange
      const app = createTestApp();
      mockParseArticle.mockResolvedValue(MOCK_PARSED_ARTICLE);
      mockInsertReturning.mockResolvedValue([
        {
          id: "article_test_01",
          userId: MOCK_USER.id,
          url: "https://zenn.dev/test/articles/test-article",
          ...MOCK_PARSED_ARTICLE,
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      await postArticle(app, {
        url: "https://zenn.dev/test/articles/test-article",
      });

      // Assert
      expect(mockParseArticle).toHaveBeenCalledWith("https://zenn.dev/test/articles/test-article");
    });

    it("レスポンスにid, url, title, source, createdAtが含まれること", async () => {
      // Arrange
      const app = createTestApp();
      mockParseArticle.mockResolvedValue(MOCK_PARSED_ARTICLE);
      mockInsertReturning.mockResolvedValue([
        {
          id: "article_test_01",
          userId: MOCK_USER.id,
          url: "https://zenn.dev/test/articles/test-article",
          title: "テスト記事タイトル",
          source: "zenn",
          author: "テスト著者",
          content: "# テスト記事\n\nこれはテスト記事です。",
          excerpt: "テスト記事の概要",
          thumbnailUrl: "https://example.com/thumb.png",
          readingTimeMinutes: 3,
          isRead: false,
          isFavorite: false,
          isPublic: false,
          publishedAt: new Date("2024-01-15"),
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await postArticle(app, {
        url: "https://zenn.dev/test/articles/test-article",
      });

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("url");
      expect(body.data).toHaveProperty("title");
      expect(body.data).toHaveProperty("source");
      expect(body.data).toHaveProperty("createdAt");
    });
  });

  describe("バリデーションエラー", () => {
    it("urlが未指定の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postArticle(app, {});

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("urlが空文字の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postArticle(app, { url: "" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("urlが不正な形式の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postArticle(app, { url: "not-a-valid-url" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("urlがhttp/https以外の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postArticle(app, { url: "ftp://example.com/article" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postArticle(app, {});

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.error?.message).toBe("入力内容を確認してください");
    });
  });

  describe("重複エラー", () => {
    it("同一ユーザーが同じURLを保存済みの場合409を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([
        { id: "existing_article_01", url: "https://zenn.dev/test/articles/test-article" },
      ]);

      // Act
      const res = await postArticle(app, {
        url: "https://zenn.dev/test/articles/test-article",
      });

      // Assert
      expect(res.status).toBe(HTTP_CONFLICT);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("DUPLICATE");
    });

    it("重複エラーのメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([
        { id: "existing_article_01", url: "https://zenn.dev/test/articles/test-article" },
      ]);

      // Act
      const res = await postArticle(app, {
        url: "https://zenn.dev/test/articles/test-article",
      });

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.error?.message).toBe("この記事はすでに保存されています");
    });
  });

  describe("パースエラー", () => {
    it("parseArticleが失敗した場合500を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockParseArticle.mockRejectedValue(new Error("パースに失敗しました"));

      // Act
      const res = await postArticle(app, {
        url: "https://example.com/article",
      });

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createTestApp();
      mockParseArticle.mockResolvedValue(MOCK_PARSED_ARTICLE);
      mockInsertReturning.mockResolvedValue([
        {
          id: "article_test_01",
          userId: MOCK_USER.id,
          url: "https://zenn.dev/test/articles/test-article",
          ...MOCK_PARSED_ARTICLE,
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await postArticle(app, {
        url: "https://zenn.dev/test/articles/test-article",
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("エラーレスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postArticle(app, {});

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const app = createTestApp();
      mockParseArticle.mockResolvedValue(MOCK_PARSED_ARTICLE);
      mockInsertReturning.mockResolvedValue([
        {
          id: "article_test_01",
          userId: MOCK_USER.id,
          url: "https://zenn.dev/test/articles/test-article",
          ...MOCK_PARSED_ARTICLE,
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await postArticle(app, {
        url: "https://zenn.dev/test/articles/test-article",
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});
