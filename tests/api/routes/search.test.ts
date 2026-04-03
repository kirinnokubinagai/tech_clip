import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../../../apps/api/src/lib/http-status";
import type { SearchQueryFn } from "../../../apps/api/src/routes/search";
import { createSearchRoute, escapeLikeWildcards } from "../../../apps/api/src/routes/search";

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
  title: `テスト記事 React ${i + 1}`,
  author: `著者 ${i + 1}`,
  content: `記事本文 React hooks ${i + 1}`,
  excerpt: `概要 React ${i + 1}`,
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: i < 10,
  isFavorite: i < 5,
  isPublic: false,
  publishedAt: new Date(`2024-01-${String(25 - i).padStart(2, "0")}`),
  createdAt: new Date(`2024-01-${String(25 - i).padStart(2, "0")}`),
  updatedAt: new Date(`2024-01-${String(25 - i).padStart(2, "0")}`),
}));

/** 検索レスポンスの型定義 */
type SearchResponseBody = {
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

/** モック検索クエリ関数の型 */
type MockSearchQueryFn = ReturnType<typeof vi.fn<SearchQueryFn>>;

/**
 * 認証済みのテスト用Honoアプリを作成する
 *
 * @param mockSearchQueryFn - 検索クエリのモック関数
 * @returns テスト用Honoアプリ
 */
function createTestApp(mockSearchQueryFn: MockSearchQueryFn) {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("/api/articles/search", (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const searchRoute = createSearchRoute({
    searchQueryFn: mockSearchQueryFn,
  });
  app.route("/api/articles", searchRoute);

  return app;
}

/**
 * 認証なしのテスト用Honoアプリを作成する
 *
 * @param mockSearchQueryFn - 検索クエリのモック関数
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createTestAppWithoutAuth(mockSearchQueryFn: MockSearchQueryFn) {
  const app = new Hono();

  const searchRoute = createSearchRoute({
    searchQueryFn: mockSearchQueryFn,
  });
  app.route("/api/articles", searchRoute);

  return app;
}

describe("escapeLikeWildcards", () => {
  it("通常の文字列はそのまま返すこと", () => {
    // Arrange
    const input = "React hooks";

    // Act
    const result = escapeLikeWildcards(input);

    // Assert
    expect(result).toBe("React hooks");
  });

  it("%を含む場合エスケープされること", () => {
    // Arrange
    const input = "100%完了";

    // Act
    const result = escapeLikeWildcards(input);

    // Assert
    expect(result).toBe("100\\%完了");
  });

  it("_を含む場合エスケープされること", () => {
    // Arrange
    const input = "foo_bar";

    // Act
    const result = escapeLikeWildcards(input);

    // Assert
    expect(result).toBe("foo\\_bar");
  });

  it("バックスラッシュを含む場合エスケープされること", () => {
    // Arrange
    const input = "C:\\path";

    // Act
    const result = escapeLikeWildcards(input);

    // Assert
    expect(result).toBe("C:\\\\path");
  });

  it("%と_が混在する場合すべてエスケープされること", () => {
    // Arrange
    const input = "50%_off";

    // Act
    const result = escapeLikeWildcards(input);

    // Assert
    expect(result).toBe("50\\%\\_off");
  });

  it("空文字列は空文字列を返すこと", () => {
    // Arrange
    const input = "";

    // Act
    const result = escapeLikeWildcards(input);

    // Assert
    expect(result).toBe("");
  });
});

describe("GET /api/articles/search", () => {
  let mockSearchQueryFn: MockSearchQueryFn;

  beforeEach(() => {
    mockSearchQueryFn = vi.fn<SearchQueryFn>();
  });

  describe("認証", () => {
    it("認証済みユーザーが検索できること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 3));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
    });

    it("未認証の場合401が返ること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestAppWithoutAuth(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("バリデーション", () => {
    it("qパラメータが未指定の場合422が返ること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("qパラメータが空文字の場合422が返ること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("qパラメータが200文字を超える場合422が返ること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);
      const longQuery = "a".repeat(201);

      // Act
      const res = await app.request(`/api/articles/search?q=${longQuery}`);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが1未満の場合422が返ること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React&limit=0");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが50を超える場合422が返ること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React&limit=51");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが数値でない場合422が返ること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React&limit=abc");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search");

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("入力内容を確認してください");
    });
  });

  describe("ページネーション", () => {
    it("デフォルトで20件の検索結果を返すこと", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponseBody;
      expect(body.data).toHaveLength(20);
    });

    it("limitパラメータで取得件数を変更できること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 11));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React&limit=10");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponseBody;
      expect(body.data).toHaveLength(10);
    });

    it("次のページがある場合hasNextがtrueであること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      const body = (await res.json()) as SearchResponseBody;
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).not.toBeNull();
    });

    it("次のページがない場合hasNextがfalseであること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 5));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      const body = (await res.json()) as SearchResponseBody;
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });

    it("cursorパラメータで次ページを取得できること", async () => {
      // Arrange
      const nextPageArticles = MOCK_ARTICLES.slice(20, 25);
      mockSearchQueryFn.mockResolvedValue(nextPageArticles);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React&cursor=article_020");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponseBody;
      expect(body.data).toHaveLength(5);
      expect(body.meta.hasNext).toBe(false);
    });

    it("nextCursorが最後の記事のIDであること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 21));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      const body = (await res.json()) as SearchResponseBody;
      const lastArticle = body.data[body.data.length - 1];
      expect(body.meta.nextCursor).toBe(lastArticle.id);
    });
  });

  describe("クエリ関数への引数", () => {
    it("userIdがクエリ関数に渡されること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      await app.request("/api/articles/search?q=React");

      // Assert
      expect(mockSearchQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_USER.id }),
      );
    });

    it("検索キーワードがクエリ関数に渡されること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      await app.request("/api/articles/search?q=React");

      // Assert
      expect(mockSearchQueryFn).toHaveBeenCalledWith(expect.objectContaining({ query: "React" }));
    });

    it("limitがクエリ関数にlimit+1で渡されること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      await app.request("/api/articles/search?q=React&limit=15");

      // Assert
      expect(mockSearchQueryFn).toHaveBeenCalledWith(expect.objectContaining({ limit: 16 }));
    });

    it("cursorがクエリ関数に渡されること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      await app.request("/api/articles/search?q=React&cursor=article_010");

      // Assert
      expect(mockSearchQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "article_010" }),
      );
    });

    it("cursor未指定時はundefinedが渡されること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      await app.request("/api/articles/search?q=React");

      // Assert
      expect(mockSearchQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: undefined }),
      );
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 3));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("nextCursor");
      expect(body.meta).toHaveProperty("hasNext");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("検索結果にcontentフィールドが含まれないこと", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue(MOCK_ARTICLES.slice(0, 1));
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      const body = (await res.json()) as SearchResponseBody;
      expect(body.data[0]).not.toHaveProperty("content");
    });

    it("空の検索結果でも正常なレスポンス形式であること", async () => {
      // Arrange
      mockSearchQueryFn.mockResolvedValue([]);
      const app = createTestApp(mockSearchQueryFn);

      // Act
      const res = await app.request("/api/articles/search?q=React");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });
  });
});
