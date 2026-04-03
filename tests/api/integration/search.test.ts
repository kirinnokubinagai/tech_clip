import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchQueryFn } from "../../../apps/api/src/routes/search";
import { createSearchRoute } from "../../../apps/api/src/routes/search";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_search_01",
  email: "search@example.com",
  name: "検索テストユーザー",
};

/** テスト用検索結果データ */
const MOCK_SEARCH_RESULTS = Array.from({ length: 3 }, (_, i) => ({
  id: `search_result_${String(i + 1).padStart(3, "0")}`,
  userId: MOCK_USER.id,
  url: `https://example.com/search-${i + 1}`,
  source: "zenn",
  title: `検索結果記事 ${i + 1}`,
  author: `著者 ${i + 1}`,
  content: `記事本文 ${i + 1}`,
  excerpt: `概要 ${i + 1}`,
  thumbnailUrl: null,
  readingTimeMinutes: 3,
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

/** 検索レスポンスの型定義 */
type SearchResponse = {
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

/**
 * テスト用アプリを生成する
 *
 * @param mockSearchQueryFn - モック検索クエリ関数
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(
  mockSearchQueryFn: ReturnType<typeof vi.fn<SearchQueryFn>>,
  authenticated = true,
) {
  const route = createSearchRoute({ searchQueryFn: mockSearchQueryFn });
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

describe("検索API 統合テスト", () => {
  let mockSearchQueryFn: ReturnType<typeof vi.fn<SearchQueryFn>>;

  beforeEach(() => {
    mockSearchQueryFn = vi.fn<SearchQueryFn>().mockResolvedValue(MOCK_SEARCH_RESULTS);
  });

  describe("GET /search", () => {
    it("キーワードで記事を検索できること", async () => {
      // Arrange
      const app = createTestApp(mockSearchQueryFn);
      const req = new Request("http://localhost/search?q=テスト");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as SearchResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockSearchQueryFn, false);
      const req = new Request("http://localhost/search?q=テスト");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("qパラメータが未指定の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockSearchQueryFn);
      const req = new Request("http://localhost/search");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("qパラメータが空の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockSearchQueryFn);
      const req = new Request("http://localhost/search?q=");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitパラメータが不正な場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockSearchQueryFn);
      const req = new Request("http://localhost/search?q=テスト&limit=abc");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("contentフィールドがレスポンスから除外されること", async () => {
      // Arrange
      const app = createTestApp(mockSearchQueryFn);
      const req = new Request("http://localhost/search?q=テスト");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as SearchResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.data[0]).not.toHaveProperty("content");
    });

    it("検索クエリをクエリ関数に渡すこと", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);
      const req = new Request("http://localhost/search?q=TypeScript");

      // Act
      await app.fetch(req);

      // Assert
      expect(mockSearchQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "TypeScript",
          userId: MOCK_USER.id,
        }),
      );
    });
  });
});
