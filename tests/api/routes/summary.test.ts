import {
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "@api/lib/http-status";
import { createSummaryRoute } from "@api/routes/summary";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
};

/** テスト用の記事データ */
const MOCK_ARTICLE = {
  id: "article_001",
  userId: MOCK_USER.id,
  url: "https://example.com/article-1",
  source: "zenn",
  title: "テスト記事",
  author: "テスト著者",
  content: "# テスト記事\n\nこれはテスト記事の本文です。",
  excerpt: "概要",
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: false,
  publishedAt: new Date("2024-01-15"),
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

/** テスト用の要約データ */
const MOCK_SUMMARY = {
  id: "summary_001",
  articleId: MOCK_ARTICLE.id,
  language: "ja",
  summary: "この記事はテストについて解説しています。",
  model: "gemma-4-26b-a4b",
  createdAt: new Date("2024-01-15"),
};

/** テスト用 Ai モックバインディング */
const MOCK_AI = {
  run: vi.fn().mockResolvedValue({ response: "テスト要約" }),
} as unknown as Ai;

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** 成功レスポンスの型定義 */
type SummaryResponseBody = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
};

/** モックの db.select クエリ結果 */
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

/** モックの db.insert クエリ結果 */
const mockInsertValues = vi.fn().mockReturnThis();
const mockInsertReturning = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});
mockInsertValues.mockReturnValue({ returning: mockInsertReturning });

/** モックの db.update クエリ結果 */
const mockUpdateSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockResolvedValue([]);
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

/** モックの summarizeArticle 関数 */
const mockSummarizeArticle = vi.fn();

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

  app.use("/api/articles/:id/summary", (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const summaryRoute = createSummaryRoute({
    db: mockDb as never,
    summarizeFn: mockSummarizeArticle,
    ai: MOCK_AI,
    modelTag: "gemma-4-26b-a4b",
  });
  app.route("/api", summaryRoute);

  return app;
}

/**
 * 認証なしテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createTestAppWithoutAuth() {
  const app = new Hono();

  const summaryRoute = createSummaryRoute({
    db: mockDb as never,
    summarizeFn: mockSummarizeArticle,
    ai: MOCK_AI,
    modelTag: "gemma-4-26b-a4b",
  });
  app.route("/api", summaryRoute);

  return app;
}

describe("POST /api/articles/:id/summary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSelectWhere.mockReset();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockInsertValues.mockReset();
    mockInsertReturning.mockReset();
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([MOCK_SUMMARY]);
    mockUpdateSet.mockReset();
    mockUpdateWhere.mockReset();
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue([]);
    mockSummarizeArticle.mockReset();
    mockSummarizeArticle.mockResolvedValue({
      summary: "テスト要約コンテンツ",
      model: "gemma-4-26b-a4b",
    });
  });

  it("未認証の場合401を返すこと", async () => {
    // Arrange
    const app = createTestAppWithoutAuth();

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_UNAUTHORIZED);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_REQUIRED");
  });

  it("languageが未指定の場合422を返すこと", async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Assert
    expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("不正なlanguageの場合422を返すこと", async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "fr" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("記事が存在しない場合404を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([]);

    // Act
    const res = await app.request("/api/articles/nonexistent/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_NOT_FOUND);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他ユーザーの記事の場合403を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    const otherUserArticle = { ...MOCK_ARTICLE, userId: "other_user" };
    mockSelectWhere.mockResolvedValueOnce([otherUserArticle]);

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_FORBIDDEN);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("キャッシュ済み要約がある場合はそのまま返すこと", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([MOCK_SUMMARY]);

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_OK);
    const body = (await res.json()) as SummaryResponseBody;
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      status: "completed",
      summary: {
        articleId: MOCK_ARTICLE.id,
        language: "ja",
        summary: MOCK_SUMMARY.summary,
      },
    });
    expect(mockSummarizeArticle).not.toHaveBeenCalled();
  });

  it("キャッシュがない場合は要約を同期生成して200を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_OK);
    const body = (await res.json()) as SummaryResponseBody;
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      status: "completed",
    });
    expect(mockSummarizeArticle).toHaveBeenCalledOnce();
  });

  it("記事にcontentがない場合422を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    const articleNoContent = { ...MOCK_ARTICLE, content: null };
    mockSelectWhere.mockResolvedValueOnce([articleNoContent]).mockResolvedValueOnce([]);

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("要約サービスがエラーを返した場合500を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);
    mockSummarizeArticle.mockRejectedValueOnce(new Error("要約の生成に失敗しました"));

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /api/articles/:id/summary（KV キャッシュ）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSelectWhere.mockReset();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockInsertValues.mockReset();
    mockInsertReturning.mockReset();
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([MOCK_SUMMARY]);
    mockUpdateSet.mockReset();
    mockUpdateWhere.mockReset();
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue([]);
    mockSummarizeArticle.mockReset();
    mockSummarizeArticle.mockResolvedValue({
      summary: "テスト要約コンテンツ",
      model: "gemma-4-26b-a4b",
    });
  });

  it("KV キャッシュヒット時に summarizeFn を呼び出さないこと", async () => {
    // Arrange
    const cachedData = {
      summary: MOCK_SUMMARY.summary,
      model: MOCK_SUMMARY.model,
      createdAt: MOCK_SUMMARY.createdAt.toISOString(),
    };
    const mockCache = {
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedData)),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;

    type Variables = {
      user: typeof MOCK_USER;
      session: Record<string, unknown>;
    };
    const app = new Hono<{ Variables: Variables }>();
    app.use("/api/articles/:id/summary", (c, next) => {
      c.set("user", MOCK_USER);
      c.set("session", { id: "session_01" });
      return next();
    });
    const summaryRoute = createSummaryRoute({
      db: mockDb as never,
      summarizeFn: mockSummarizeArticle,
      ai: MOCK_AI,
      modelTag: "gemma-4-26b-a4b",
      cache: mockCache,
    });
    app.route("/api", summaryRoute);

    mockSelectWhere.mockResolvedValue([MOCK_ARTICLE]);

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_OK);
    const body = (await res.json()) as SummaryResponseBody;
    expect(body.success).toBe(true);
    expect(body.data?.status).toBe("completed");
    expect(mockSummarizeArticle).not.toHaveBeenCalled();
  });

  it("KV キャッシュ書き込み失敗時もレスポンス 200 を返すこと", async () => {
    // Arrange
    const mockCache = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockRejectedValue(new Error("KV 書き込みエラー")),
    } as unknown as KVNamespace;

    type Variables = {
      user: typeof MOCK_USER;
      session: Record<string, unknown>;
    };
    const app = new Hono<{ Variables: Variables }>();
    app.use("/api/articles/:id/summary", (c, next) => {
      c.set("user", MOCK_USER);
      c.set("session", { id: "session_01" });
      return next();
    });
    const summaryRoute = createSummaryRoute({
      db: mockDb as never,
      summarizeFn: mockSummarizeArticle,
      ai: MOCK_AI,
      modelTag: "gemma-4-26b-a4b",
      cache: mockCache,
    });
    app.route("/api", summaryRoute);

    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

    // Act
    const res = await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(res.status).toBe(HTTP_OK);
    const body = (await res.json()) as SummaryResponseBody;
    expect(body.success).toBe(true);
    expect(mockSummarizeArticle).toHaveBeenCalledOnce();
  });

  it("KV キャッシュキーが summary:v1:<articleId>:<lang> 形式であること", async () => {
    // Arrange
    const mockCache = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;

    type Variables = {
      user: typeof MOCK_USER;
      session: Record<string, unknown>;
    };
    const app = new Hono<{ Variables: Variables }>();
    app.use("/api/articles/:id/summary", (c, next) => {
      c.set("user", MOCK_USER);
      c.set("session", { id: "session_01" });
      return next();
    });
    const summaryRoute = createSummaryRoute({
      db: mockDb as never,
      summarizeFn: mockSummarizeArticle,
      ai: MOCK_AI,
      modelTag: "gemma-4-26b-a4b",
      cache: mockCache,
    });
    app.route("/api", summaryRoute);

    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

    // Act
    await app.request("/api/articles/article_001/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ja" }),
    });

    // Assert
    expect(mockCache.get).toHaveBeenCalledWith("summary:v1:article_001:ja");
  });
});

describe("GET /api/articles/:id/summary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSelectWhere.mockReset();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
  });

  it("未認証の場合401を返すこと", async () => {
    // Arrange
    const app = createTestAppWithoutAuth();

    // Act
    const res = await app.request("/api/articles/article_001/summary?language=ja");

    // Assert
    expect(res.status).toBe(HTTP_UNAUTHORIZED);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_REQUIRED");
  });

  it("記事が存在しない場合404を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([]);

    // Act
    const res = await app.request("/api/articles/nonexistent/summary?language=ja");

    // Assert
    expect(res.status).toBe(HTTP_NOT_FOUND);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他ユーザーの記事の場合403を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    const otherUserArticle = { ...MOCK_ARTICLE, userId: "other_user" };
    mockSelectWhere.mockResolvedValueOnce([otherUserArticle]);

    // Act
    const res = await app.request("/api/articles/article_001/summary?language=ja");

    // Assert
    expect(res.status).toBe(HTTP_FORBIDDEN);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("要約が存在する場合200で返すこと", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([MOCK_SUMMARY]);

    // Act
    const res = await app.request("/api/articles/article_001/summary?language=ja");

    // Assert
    expect(res.status).toBe(HTTP_OK);
    const body = (await res.json()) as SummaryResponseBody;
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      articleId: MOCK_ARTICLE.id,
      language: "ja",
      summary: MOCK_SUMMARY.summary,
    });
  });

  it("要約が存在しない場合404を返すこと", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

    // Act
    const res = await app.request("/api/articles/article_001/summary?language=ja");

    // Assert
    expect(res.status).toBe(HTTP_NOT_FOUND);
    const body = (await res.json()) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("languageクエリパラメータがない場合デフォルトでjaを使用すること", async () => {
    // Arrange
    const app = createTestApp();
    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([MOCK_SUMMARY]);

    // Act
    const res = await app.request("/api/articles/article_001/summary");

    // Assert
    expect(res.status).toBe(HTTP_OK);
  });
});
