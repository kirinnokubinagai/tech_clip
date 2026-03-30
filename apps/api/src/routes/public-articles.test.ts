import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HTTP_NOT_FOUND, HTTP_OK, HTTP_UNPROCESSABLE_ENTITY } from "../lib/http-status";
import { createPublicArticlesRoute } from "./public-articles";

/** テスト用のユーザーID */
const TARGET_USER_ID = "user_01HXYZ";

/** 存在しないユーザーID */
const NONEXISTENT_USER_ID = "user_nonexistent";

/** テスト用の公開記事データ */
const MOCK_PUBLIC_ARTICLES = Array.from({ length: 5 }, (_, i) => ({
  id: `article_pub_${String(i + 1).padStart(3, "0")}`,
  userId: TARGET_USER_ID,
  url: `https://example.com/public-article-${i + 1}`,
  source: i % 2 === 0 ? "zenn" : "qiita",
  title: `公開記事 ${i + 1}`,
  author: `著者 ${i + 1}`,
  content: `記事本文 ${i + 1}`,
  excerpt: `概要 ${i + 1}`,
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: true,
  publishedAt: new Date(`2024-01-${String(5 - i).padStart(2, "0")}`),
  createdAt: new Date(`2024-01-${String(5 - i).padStart(2, "0")}`),
  updatedAt: new Date(`2024-01-${String(5 - i).padStart(2, "0")}`),
}));

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 公開記事一覧レスポンスの型定義 */
type PublicArticlesResponseBody = {
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

/** 公開記事一覧クエリ関数の型 */
type PublicArticlesQueryFn = (params: {
  userId: string;
  limit: number;
  cursor?: string;
}) => Promise<Array<Record<string, unknown>>>;

/** モッククエリ関数の型 */
type MockQueryFn = ReturnType<typeof vi.fn<PublicArticlesQueryFn>>;

/** ユーザー存在確認関数の型 */
type UserExistsFn = (userId: string) => Promise<boolean>;

/** モックのユーザー存在確認関数の型 */
type MockUserExistsFn = ReturnType<typeof vi.fn<UserExistsFn>>;

/** モッククエリ関数 */
let mockQueryFn: MockQueryFn;

/** モックのユーザー存在確認関数 */
let mockUserExistsFn: MockUserExistsFn;

/**
 * テスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createTestApp() {
  const app = new Hono();

  const publicArticlesRoute = createPublicArticlesRoute({
    queryFn: mockQueryFn,
    userExistsFn: mockUserExistsFn,
  });
  app.route("/api/users", publicArticlesRoute);

  return app;
}

describe("GET /api/users/:id/articles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFn = vi.fn<PublicArticlesQueryFn>();
    mockUserExistsFn = vi.fn<UserExistsFn>();
  });

  describe("正常系", () => {
    it("公開記事のみ返却されること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockQueryFn.mockResolvedValue(
        MOCK_PUBLIC_ARTICLES as unknown as Array<Record<string, unknown>>,
      );
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles`);
      const body = (await res.json()) as PublicArticlesResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(5);
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });

    it("認証なしでもアクセスできること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles`);
      const body = (await res.json()) as PublicArticlesResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });

    it("レスポンスにcontentフィールドが含まれないこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockQueryFn.mockResolvedValue(
        MOCK_PUBLIC_ARTICLES as unknown as Array<Record<string, unknown>>,
      );
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles`);
      const body = (await res.json()) as PublicArticlesResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      for (const article of body.data) {
        expect(article).not.toHaveProperty("content");
      }
    });

    it("デフォルトのlimitが20であること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${TARGET_USER_ID}/articles`);

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith({
        userId: TARGET_USER_ID,
        limit: DEFAULT_LIMIT + 1,
        cursor: undefined,
      });
    });

    it("limitパラメータを指定できること", async () => {
      // Arrange
      const customLimit = 10;
      mockUserExistsFn.mockResolvedValue(true);
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${TARGET_USER_ID}/articles?limit=${customLimit}`);

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith({
        userId: TARGET_USER_ID,
        limit: customLimit + 1,
        cursor: undefined,
      });
    });

    it("cursorパラメータを指定できること", async () => {
      // Arrange
      const cursor = "article_pub_003";
      mockUserExistsFn.mockResolvedValue(true);
      mockQueryFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${TARGET_USER_ID}/articles?cursor=${cursor}`);

      // Assert
      expect(mockQueryFn).toHaveBeenCalledWith({
        userId: TARGET_USER_ID,
        limit: DEFAULT_LIMIT + 1,
        cursor,
      });
    });
  });

  describe("ページネーション", () => {
    it("hasNextがtrueの場合nextCursorが返されること", async () => {
      // Arrange
      const articlesWithExtra = Array.from({ length: DEFAULT_LIMIT + 1 }, (_, i) => ({
        id: `article_pub_${String(i + 1).padStart(3, "0")}`,
        userId: TARGET_USER_ID,
        url: `https://example.com/public-article-${i + 1}`,
        source: "zenn",
        title: `公開記事 ${i + 1}`,
        author: null,
        excerpt: null,
        thumbnailUrl: null,
        readingTimeMinutes: null,
        isRead: false,
        isFavorite: false,
        isPublic: true,
        publishedAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      }));
      mockUserExistsFn.mockResolvedValue(true);
      mockQueryFn.mockResolvedValue(articlesWithExtra as unknown as Array<Record<string, unknown>>);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles`);
      const body = (await res.json()) as PublicArticlesResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).toBe(`article_pub_${String(DEFAULT_LIMIT).padStart(3, "0")}`);
      expect(body.data).toHaveLength(DEFAULT_LIMIT);
    });
  });

  describe("異常系", () => {
    it("存在しないユーザーIDの場合404エラーになること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(false);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${NONEXISTENT_USER_ID}/articles`);
      const body = (await res.json()) as ErrorResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("ユーザーが見つかりません");
    });

    it("limitが0以下の場合422エラーになること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles?limit=0`);
      const body = (await res.json()) as ErrorResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが51以上の場合422エラーになること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles?limit=51`);
      const body = (await res.json()) as ErrorResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが数値でない場合422エラーになること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles?limit=abc`);
      const body = (await res.json()) as ErrorResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが小数の場合422エラーになること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/articles?limit=10.5`);
      const body = (await res.json()) as ErrorResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });
});
