import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSummaryRoute } from "../../src/routes/summary";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_summary_01",
  email: "summary@example.com",
  name: "要約テストユーザー",
};

/** テスト用記事データ */
const MOCK_ARTICLE = {
  id: "article_summary_001",
  userId: MOCK_USER.id,
  url: "https://example.com/article",
  title: "テスト記事",
  content: "# テスト記事\n\nこれはテスト記事の本文です。",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** テスト用要約データ */
const MOCK_SUMMARY = {
  id: "summary_001",
  articleId: MOCK_ARTICLE.id,
  language: "ja",
  content: "これはテスト要約です。",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** テスト用RunPod設定 */
const MOCK_RUNPOD_CONFIG = {
  apiKey: "test_runpod_api_key",
  endpointId: "test_endpoint_id",
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

/** 要約レスポンスの型定義 */
type SummaryResponse = {
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
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
}

/**
 * テスト用アプリを生成する
 *
 * @param mockDb - モックDBオブジェクト
 * @param mockSummarizeFn - モック要約関数
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(
  mockDb: ReturnType<typeof createMockDb>,
  mockSummarizeFn: ReturnType<typeof vi.fn>,
  authenticated = true,
) {
  const route = createSummaryRoute({
    db: mockDb as unknown as Parameters<typeof createSummaryRoute>[0]["db"],
    summarizeFn: mockSummarizeFn,
    createSummaryJobFn: vi.fn().mockResolvedValue({
      providerJobId: "run_abc123",
      model: "qwen3.5-9b",
    }),
    getSummaryJobStatusFn: vi.fn(),
    runpodConfig: MOCK_RUNPOD_CONFIG,
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

describe("要約API 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockSummarizeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockSummarizeFn = vi.fn().mockResolvedValue({
      content: "テスト要約コンテンツ",
      language: "ja",
    });
  });

  describe("POST /articles/:id/summary", () => {
    it("記事の要約を生成できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);
    mockDb.returning.mockResolvedValue([MOCK_SUMMARY]);
      const app = createTestApp(mockDb, mockSummarizeFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "ja" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as SummaryResponse;

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockSummarizeFn, false);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "ja" }),
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
      const app = createTestApp(mockDb, mockSummarizeFn);
      const req = new Request("http://localhost/articles/nonexistent_article/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "ja" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("他ユーザーの記事の場合に403エラーを返すこと", async () => {
      // Arrange
      const otherUserArticle = { ...MOCK_ARTICLE, userId: "other_user_id" };
      mockDb.where.mockResolvedValue([otherUserArticle]);
      const app = createTestApp(mockDb, mockSummarizeFn);
      const req = new Request(`http://localhost/articles/${otherUserArticle.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "ja" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("不正な言語の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockSummarizeFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "fr" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("要約済みの場合に既存の要約を返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([MOCK_SUMMARY]);
      const app = createTestApp(mockDb, mockSummarizeFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "ja" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as SummaryResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(mockSummarizeFn).not.toHaveBeenCalled();
    });
  });

  describe("GET /articles/:id/summary", () => {
    it("要約を取得できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([MOCK_SUMMARY]);
      const app = createTestApp(mockDb, mockSummarizeFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/summary`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as SummaryResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockSummarizeFn, false);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/summary`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しない要約の場合に404エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);
      const app = createTestApp(mockDb, mockSummarizeFn);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/summary`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
