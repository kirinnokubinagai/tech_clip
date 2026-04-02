import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HTTP_CREATED,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../../src/lib/http-status";
import { createAiRoute } from "../../src/routes/ai";

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_ai_01",
  email: "ai@example.com",
  name: "AIテストユーザー",
};

/** テスト用記事データ */
const MOCK_ARTICLE = {
  id: "article_ai_001",
  userId: MOCK_USER.id,
  url: "https://example.com/article",
  title: "テスト記事",
  content: "# テスト記事\n\nこれはテスト記事の本文です。",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** テスト用翻訳データ */
const MOCK_TRANSLATION = {
  id: "translation_001",
  articleId: MOCK_ARTICLE.id,
  language: "en",
  title: "Test Article",
  content: "# Test Article\n\nThis is the test article body.",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
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

/** 翻訳レスポンスの型定義 */
type TranslationResponse = {
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
 * @param mockTranslateFn - モック翻訳関数
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(
  mockDb: ReturnType<typeof createMockDb>,
  mockTranslateFn: ReturnType<typeof vi.fn>,
  authenticated = true,
) {
  const route = createAiRoute({
    db: mockDb as unknown as Parameters<typeof createAiRoute>[0]["db"],
    translateArticleFn: mockTranslateFn,
    createTranslationJobFn: vi.fn().mockResolvedValue({
      providerJobId: "run_abc123",
      model: "qwen3.5-9b",
    }),
    getTranslationJobStatusFn: vi.fn(),
    runpodConfig: {
      apiKey: "test-api-key",
      endpointId: "test-endpoint-id",
    },
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

describe("AI翻訳API 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockTranslateFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockTranslateFn = vi.fn().mockResolvedValue({
      title: "Test Article",
      content: "# Test Article\n\nThis is the test article body.",
      language: "en",
    });
  });

  describe("POST /articles/:id/translate", () => {
    it("記事を翻訳できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);
      mockDb.returning.mockResolvedValue([MOCK_TRANSLATION]);
      const app = createTestApp(mockDb, mockTranslateFn);
      const req = new Request(`http://localhost/${MOCK_ARTICLE.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as TranslationResponse;

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockTranslateFn, false);
      const req = new Request(`http://localhost/${MOCK_ARTICLE.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
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
      const app = createTestApp(mockDb, mockTranslateFn);
      const req = new Request("http://localhost/nonexistent_article/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
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
      const app = createTestApp(mockDb, mockTranslateFn);
      const req = new Request(`http://localhost/${otherUserArticle.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
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
      const app = createTestApp(mockDb, mockTranslateFn);
      const req = new Request(`http://localhost/${MOCK_ARTICLE.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "fr" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("翻訳済みの場合に既存の翻訳を返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([MOCK_TRANSLATION]);
      const app = createTestApp(mockDb, mockTranslateFn);
      const req = new Request(`http://localhost/${MOCK_ARTICLE.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as TranslationResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(mockTranslateFn).not.toHaveBeenCalled();
    });
  });

  describe("GET /articles/:id/translate", () => {
    it("翻訳を取得できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([MOCK_TRANSLATION]);
      const app = createTestApp(mockDb, mockTranslateFn);
      const req = new Request(`http://localhost/${MOCK_ARTICLE.id}/translate?targetLanguage=en`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as TranslationResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, mockTranslateFn, false);
      const req = new Request(`http://localhost/${MOCK_ARTICLE.id}/translate`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しない翻訳の場合に404エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);
      const app = createTestApp(mockDb, mockTranslateFn);
      const req = new Request(`http://localhost/${MOCK_ARTICLE.id}/translate?targetLanguage=en`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
