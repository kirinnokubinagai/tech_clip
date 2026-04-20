import {
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "@api/lib/http-status";
import type { ArticlesQueryFn } from "@api/routes/articles";
import { createArticlesRoute } from "@api/routes/articles";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

/** GET レスポンスの型定義 */
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

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** POST レスポンスの型定義 */
type ArticleResponseBody = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** モックDBクエリ関数の型 */
type MockQueryFn = ReturnType<typeof vi.fn<ArticlesQueryFn>>;

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

/** モックの db.update クエリ結果 */
const mockUpdateSetWhere = vi.fn();
const mockUpdateSet = vi.fn().mockReturnValue({
  where: mockUpdateSetWhere,
});
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックの db.delete クエリ結果 */
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn().mockReturnValue({
  where: mockDeleteWhere,
});

/** モックのDBインスタンス */
const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
  delete: mockDelete,
};

/**
 * GET テスト用Honoアプリを作成する
 *
 * @param mockQueryFn - 記事一覧クエリのモック関数
 * @returns テスト用Honoアプリ
 */
function createGetTestApp(mockQueryFn: MockQueryFn) {
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

  const articlesRoute = createArticlesRoute({
    db: mockDb as never,
    parseArticleFn: mockParseArticle,
    queryFn: mockQueryFn,
  });
  app.route("/api/articles", articlesRoute);

  return app;
}

/**
 * 認証なしのGETテスト用Honoアプリを作成する
 *
 * @param mockQueryFn - 記事一覧クエリのモック関数
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createGetTestAppWithoutAuth(mockQueryFn: MockQueryFn) {
  const app = new Hono();

  const articlesRoute = createArticlesRoute({
    db: mockDb as never,
    parseArticleFn: mockParseArticle,
    queryFn: mockQueryFn,
  });
  app.route("/api/articles", articlesRoute);

  return app;
}

/**
 * POST テスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createPostTestApp() {
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

  const mockQueryFn = vi.fn<ArticlesQueryFn>().mockResolvedValue([]);
  const articlesRoute = createArticlesRoute({
    db: mockDb as never,
    parseArticleFn: mockParseArticle,
    queryFn: mockQueryFn,
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

/** 個別記事テスト用のモック記事データ */
const MOCK_SINGLE_ARTICLE = {
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

/** 他ユーザーの記事データ */
const MOCK_OTHER_USER_ARTICLE = {
  ...MOCK_SINGLE_ARTICLE,
  id: "article_other_001",
  userId: "other_user_01",
};

/**
 * 個別記事エンドポイント用テストアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証あり）
 */
function createSingleArticleTestApp() {
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

  const mockQueryFn = vi.fn<ArticlesQueryFn>().mockResolvedValue([]);
  const articlesRoute = createArticlesRoute({
    db: mockDb as never,
    parseArticleFn: mockParseArticle,
    queryFn: mockQueryFn,
  });
  app.route("/api/articles", articlesRoute);

  return app;
}

/**
 * 個別記事エンドポイント用の未認証テストアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証なし）
 */
function createSingleArticleTestAppWithoutAuth() {
  const app = new Hono();

  const mockQueryFn = vi.fn<ArticlesQueryFn>().mockResolvedValue([]);
  const articlesRoute = createArticlesRoute({
    db: mockDb as never,
    parseArticleFn: mockParseArticle,
    queryFn: mockQueryFn,
  });
  app.route("/api/articles", articlesRoute);

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
      const fetchedArticles = MOCK_ARTICLES.slice(0, 20);
      mockQueryFn.mockResolvedValue(fetchedArticles.concat([MOCK_ARTICLES[20]]));
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestAppWithoutAuth(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("ページネーション", () => {
    it("デフォルトで20件の記事を返すこと", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?cursor=article_020");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.data).toHaveLength(5);
      expect(body.meta.hasNext).toBe(false);
    });

    it("nextCursorが複合カーソル（createdAt+id）を含むこと", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.meta.nextCursor).not.toBeNull();
      const decoded = JSON.parse(
        Buffer.from(body.meta.nextCursor as string, "base64url").toString(),
      ) as { createdAt: string; id: string };
      const lastArticle = body.data[body.data.length - 1];
      expect(decoded.id).toBe(lastArticle.id);
      expect(decoded.createdAt).toBeDefined();
    });
  });

  describe("フィルタリング", () => {
    it("source パラメータでフィルタリングできること", async () => {
      // Arrange
      const zennArticles = MOCK_ARTICLES.filter((a) => a.source === "zenn");
      mockQueryFn.mockResolvedValue(zennArticles);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?source=zenn");

      // Assert
      expect(res.status).toBe(200);
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ source: "zenn" }));
    });

    it("isFavorite パラメータでフィルタリングできること", async () => {
      // Arrange
      const favoriteArticles = MOCK_ARTICLES.filter((a) => a.isFavorite);
      mockQueryFn.mockResolvedValue(favoriteArticles);
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?isRead=true");

      // Assert
      expect(res.status).toBe(200);
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ isRead: true }));
    });

    it("複数のフィルターを組み合わせて使用できること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?limit=0");

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
      const res = await app.request("/api/articles?limit=51");

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
      const res = await app.request("/api/articles?limit=abc");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("isFavoriteがtrue/false以外の場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?isFavorite=invalid");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("isReadがtrue/false以外の場合422が返ること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles?isRead=invalid");

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
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 3));
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("記事データにcontentフィールドが含まれないこと", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 1));
      const app = createGetTestApp(mockQueryFn);

      // Act
      const res = await app.request("/api/articles");

      // Assert
      const body = (await res.json()) as ArticlesResponseBody;
      expect(body.data[0]).not.toHaveProperty("content");
    });

    it("空の配列が返る場合も正常なレスポンス形式であること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

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
      const app = createGetTestApp(mockQueryFn);

      // Act
      await app.request("/api/articles");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ userId: MOCK_USER.id }));
    });

    it("limitがクエリ関数に渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      await app.request("/api/articles?limit=15");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ limit: 16 }));
    });

    it("cursorがクエリ関数に渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

      // Act
      await app.request("/api/articles?cursor=article_010");

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ cursor: "article_010" }));
    });

    it("フィルター未指定時はundefinedが渡されること", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createGetTestApp(mockQueryFn);

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
      const app = createPostTestApp();
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
      const app = createPostTestApp();
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
      const app = createPostTestApp();
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
      const app = createPostTestApp();

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
      const app = createPostTestApp();

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
      const app = createPostTestApp();

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
      const app = createPostTestApp();

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
      const app = createPostTestApp();

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
      const app = createPostTestApp();
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
      const app = createPostTestApp();
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
      const app = createPostTestApp();
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

    it("YouTube字幕なしエラー(NO_CAPTIONS)の場合422を返すこと", async () => {
      // Arrange
      const app = createPostTestApp();
      mockSelectWhere.mockResolvedValue([]);
      mockParseArticle.mockRejectedValue(new Error("NO_CAPTIONS"));

      // Act
      const res = await postArticle(app, {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("NO_CAPTIONS");
    });

    it("YouTube字幕なしエラーのメッセージが日本語であること", async () => {
      // Arrange
      const app = createPostTestApp();
      mockSelectWhere.mockResolvedValue([]);
      mockParseArticle.mockRejectedValue(new Error("NO_CAPTIONS"));

      // Act
      const res = await postArticle(app, {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      });

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.error?.message).toBe(
        "この動画には字幕がないため、要約できません。別の動画をお試しください",
      );
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createPostTestApp();
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
      const app = createPostTestApp();

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
      const app = createPostTestApp();
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

describe("GET /api/articles/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("認証済みユーザーが自分の記事を取得できること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);

      // Act
      const res = await app.request("/api/articles/article_001");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: "article_001",
        title: "テスト記事 1",
        source: "zenn",
      });
    });

    it("レスポンスにcontentフィールドが含まれること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);

      // Act
      const res = await app.request("/api/articles/article_001");

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.data).toHaveProperty("content", "記事本文 1");
    });
  });

  describe("認証エラー", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/articles/article_001");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("所有者チェック", () => {
    it("他ユーザーの記事にアクセスすると403が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_OTHER_USER_ARTICLE]);

      // Act
      const res = await app.request("/api/articles/article_other_001");

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("存在しない記事", () => {
    it("存在しない記事IDの場合404が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/articles/nonexistent_id");

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);

      // Act
      const res = await app.request("/api/articles/article_001");

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });
  });
});

describe("PATCH /api/articles/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("isReadを更新できること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);
      const updatedArticle = { ...MOCK_SINGLE_ARTICLE, isRead: true, updatedAt: new Date() };
      mockUpdateSetWhere.mockResolvedValue([updatedArticle]);

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ isRead: true });
    });

    it("isFavoriteを更新できること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);
      const updatedArticle = { ...MOCK_SINGLE_ARTICLE, isFavorite: true, updatedAt: new Date() };
      mockUpdateSetWhere.mockResolvedValue([updatedArticle]);

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: true }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ isFavorite: true });
    });

    it("isPublicを更新できること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);
      const updatedArticle = { ...MOCK_SINGLE_ARTICLE, isPublic: true, updatedAt: new Date() };
      mockUpdateSetWhere.mockResolvedValue([updatedArticle]);

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ isPublic: true });
    });

    it("複数フィールドを同時に更新できること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);
      const updatedArticle = {
        ...MOCK_SINGLE_ARTICLE,
        isRead: true,
        isFavorite: true,
        updatedAt: new Date(),
      };
      mockUpdateSetWhere.mockResolvedValue([updatedArticle]);

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true, isFavorite: true }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ArticleResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ isRead: true, isFavorite: true });
    });
  });

  describe("認証エラー", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("所有者チェック", () => {
    it("他ユーザーの記事を更新しようとすると403が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_OTHER_USER_ARTICLE]);

      // Act
      const res = await app.request("/api/articles/article_other_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("存在しない記事", () => {
    it("存在しない記事IDの場合404が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/articles/nonexistent_id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("バリデーション", () => {
    it("更新フィールドが空の場合422が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();

      // Act
      const res = await app.request("/api/articles/article_001", {
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

    it("不正な型のフィールドの場合422が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: "not-a-boolean" }),
      });

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
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);
      const updatedArticle = { ...MOCK_SINGLE_ARTICLE, isRead: true, updatedAt: new Date() };
      mockUpdateSetWhere.mockResolvedValue([updatedArticle]);

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      // Assert
      const body = (await res.json()) as ArticleResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });
  });
});

describe("DELETE /api/articles/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("自分の記事を削除して204を返すこと", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_SINGLE_ARTICLE]);
      mockDeleteWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NO_CONTENT);
    });
  });

  describe("認証エラー", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/articles/article_001", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("所有者チェック", () => {
    it("他ユーザーの記事を削除しようとすると403が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([MOCK_OTHER_USER_ARTICLE]);

      // Act
      const res = await app.request("/api/articles/article_other_001", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("存在しない記事", () => {
    it("存在しない記事IDの場合404が返ること", async () => {
      // Arrange
      const app = createSingleArticleTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/articles/nonexistent_id", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
