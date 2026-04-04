import type { PublicArticlesQueryFn, UserExistsFn } from "@api/routes/public-articles";
import { createPublicArticlesRoute } from "@api/routes/public-articles";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** テスト用記事データ */
const MOCK_PUBLIC_ARTICLES = Array.from({ length: 3 }, (_, i) => ({
  id: `pub_article_${String(i + 1).padStart(3, "0")}`,
  userId: "public_user_01",
  url: `https://example.com/public-article-${i + 1}`,
  source: "zenn",
  title: `公開記事 ${i + 1}`,
  author: `著者 ${i + 1}`,
  content: `記事本文 ${i + 1}`,
  excerpt: `概要 ${i + 1}`,
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: true,
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

/** 公開記事一覧レスポンスの型定義 */
type PublicArticlesResponse = {
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
 * @param mockQueryFn - モッククエリ関数
 * @param mockUserExistsFn - モックユーザー存在確認関数
 * @returns テスト用 Hono アプリ
 */
function createTestApp(
  mockQueryFn: ReturnType<typeof vi.fn<PublicArticlesQueryFn>>,
  mockUserExistsFn: ReturnType<typeof vi.fn<UserExistsFn>>,
) {
  const route = createPublicArticlesRoute({
    queryFn: mockQueryFn,
    userExistsFn: mockUserExistsFn,
  });

  const app = new Hono();
  app.route("/users", route);
  return app;
}

describe("公開記事API 統合テスト", () => {
  let mockQueryFn: ReturnType<typeof vi.fn<PublicArticlesQueryFn>>;
  let mockUserExistsFn: ReturnType<typeof vi.fn<UserExistsFn>>;

  beforeEach(() => {
    mockQueryFn = vi.fn<PublicArticlesQueryFn>().mockResolvedValue(MOCK_PUBLIC_ARTICLES);
    mockUserExistsFn = vi.fn<UserExistsFn>().mockResolvedValue(true);
  });

  describe("GET /users/:userId/articles", () => {
    it("存在するユーザーの公開記事一覧を取得できること", async () => {
      // Arrange
      const app = createTestApp(mockQueryFn, mockUserExistsFn);
      const req = new Request("http://localhost/users/public_user_01/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as PublicArticlesResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.meta.hasNext).toBe(false);
    });

    it("存在しないユーザーの場合に404エラーを返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(false);
      const app = createTestApp(mockQueryFn, mockUserExistsFn);
      const req = new Request("http://localhost/users/nonexistent_user/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("limitパラメータが不正な場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockQueryFn, mockUserExistsFn);
      const req = new Request("http://localhost/users/public_user_01/articles?limit=abc");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitパラメータが範囲外の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockQueryFn, mockUserExistsFn);
      const req = new Request("http://localhost/users/public_user_01/articles?limit=100");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("21件以上ある場合にhasNextがtrueになること", async () => {
      // Arrange
      const manyArticles = Array.from({ length: 21 }, (_, i) => ({
        ...MOCK_PUBLIC_ARTICLES[0],
        id: `pub_many_${i}`,
      }));
      mockQueryFn.mockResolvedValue(manyArticles);
      const app = createTestApp(mockQueryFn, mockUserExistsFn);
      const req = new Request("http://localhost/users/public_user_01/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as PublicArticlesResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).not.toBeNull();
    });

    it("contentフィールドがレスポンスから除外されること", async () => {
      // Arrange
      const app = createTestApp(mockQueryFn, mockUserExistsFn);
      const req = new Request("http://localhost/users/public_user_01/articles");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as PublicArticlesResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.data[0]).not.toHaveProperty("content");
    });

    it("cursorパラメータをクエリ関数に渡すこと", async () => {
      // Arrange
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockQueryFn, mockUserExistsFn);
      const cursor = "pub_article_003";
      const req = new Request(`http://localhost/users/public_user_01/articles?cursor=${cursor}`);

      // Act
      await app.fetch(req);

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith(expect.objectContaining({ cursor }));
    });
  });
});
