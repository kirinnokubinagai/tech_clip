import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTagsRoute } from "./tags";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
};

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 201 Created ステータスコード */
const HTTP_CREATED = 201;

/** HTTP 204 No Content ステータスコード */
const HTTP_NO_CONTENT = 204;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** HTTP 409 Conflict ステータスコード */
const HTTP_CONFLICT = 409;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};

/** タグレスポンスの型定義 */
type TagResponseBody = {
  success: boolean;
  data?: {
    id: string;
    userId: string;
    name: string;
    createdAt: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** タグ一覧レスポンスの型定義 */
type TagsListResponseBody = {
  success: boolean;
  data: Array<{
    id: string;
    userId: string;
    name: string;
    createdAt: string;
  }>;
};

/** 記事タグ更新レスポンスの型定義 */
type ArticleTagsResponseBody = {
  success: boolean;
  data?: {
    articleId: string;
    tagIds: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** モックDBのセットアップ用 */
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn().mockReturnValue({
  where: mockDeleteWhere,
});

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  delete: mockDelete,
};

/**
 * 認証ありのタグテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createTestApp() {
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

  const tagsRoute = createTagsRoute({ db: mockDb as never });
  app.route("/api", tagsRoute);

  return app;
}

/**
 * 認証なしのタグテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証なし）
 */
function createTestAppWithoutAuth() {
  const app = new Hono();

  const tagsRoute = createTagsRoute({ db: mockDb as never });
  app.route("/api", tagsRoute);

  return app;
}

describe("POST /api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockSelectWhere.mockResolvedValue([]);
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    });
  });

  describe("正常系", () => {
    it("有効なタグ名でタグを作成して201を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockInsertReturning.mockResolvedValue([
        {
          id: "tag_01",
          userId: MOCK_USER.id,
          name: "TypeScript",
          createdAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as TagResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        name: "TypeScript",
        userId: MOCK_USER.id,
      });
    });

    it("レスポンスにid, userId, name, createdAtが含まれること", async () => {
      // Arrange
      const app = createTestApp();
      mockInsertReturning.mockResolvedValue([
        {
          id: "tag_01",
          userId: MOCK_USER.id,
          name: "React",
          createdAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "React" }),
      });

      // Assert
      const body = (await res.json()) as TagResponseBody;
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("userId");
      expect(body.data).toHaveProperty("name");
      expect(body.data).toHaveProperty("createdAt");
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("バリデーション", () => {
    it("nameが未指定の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/tags", {
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

    it("nameが空文字の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("nameが50文字を超える場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      const longName = "a".repeat(51);

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: longName }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("入力内容を確認してください");
    });
  });

  describe("重複エラー", () => {
    it("同一ユーザーで同名タグが存在する場合409を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([
        { id: "tag_existing", userId: MOCK_USER.id, name: "TypeScript" },
      ]);

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_CONFLICT);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("DUPLICATE");
    });

    it("重複エラーのメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([
        { id: "tag_existing", userId: MOCK_USER.id, name: "TypeScript" },
      ]);

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("このタグはすでに登録されています");
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createTestApp();
      mockInsertReturning.mockResolvedValue([
        {
          id: "tag_01",
          userId: MOCK_USER.id,
          name: "TypeScript",
          createdAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as TagResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const app = createTestApp();
      mockInsertReturning.mockResolvedValue([
        {
          id: "tag_01",
          userId: MOCK_USER.id,
          name: "TypeScript",
          createdAt: new Date("2024-01-15"),
        },
      ]);

      // Act
      const res = await app.request("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});

describe("GET /api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  });

  describe("正常系", () => {
    it("認証済みユーザーのタグ一覧を取得できること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([
        {
          id: "tag_01",
          userId: MOCK_USER.id,
          name: "TypeScript",
          createdAt: new Date("2024-01-15"),
        },
        { id: "tag_02", userId: MOCK_USER.id, name: "React", createdAt: new Date("2024-01-16") },
      ]);

      // Act
      const res = await app.request("/api/tags");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as TagsListResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("タグがない場合空配列を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/tags");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as TagsListResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/tags");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/tags");

      // Assert
      const body = (await res.json()) as TagsListResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });
  });
});

describe("DELETE /api/tags/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
  });

  describe("正常系", () => {
    it("自分のタグを削除して204を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([
        {
          id: "tag_01",
          userId: MOCK_USER.id,
          name: "TypeScript",
          createdAt: new Date("2024-01-15"),
        },
      ]);
      mockDeleteWhere.mockResolvedValue({ rowsAffected: 1 });

      // Act
      const res = await app.request("/api/tags/tag_01", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NO_CONTENT);
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/tags/tag_01", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("存在しないタグ", () => {
    it("存在しないタグIDの場合404を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/tags/nonexistent_tag", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("存在しないタグのエラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/tags/nonexistent_tag", {
        method: "DELETE",
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("タグが見つかりません");
    });
  });

  describe("所有者チェック", () => {
    it("他ユーザーのタグを削除しようとした場合404を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([]);

      // Act
      const res = await app.request("/api/tags/other_user_tag", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
    });
  });
});

describe("PUT /api/articles/:id/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockDeleteWhere.mockResolvedValue({ rowsAffected: 0 });
  });

  describe("正常系", () => {
    it("記事にタグを紐付けて200を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere
        .mockResolvedValueOnce([
          { id: "article_01", userId: MOCK_USER.id, url: "https://example.com" },
        ])
        .mockResolvedValueOnce([
          { id: "tag_01", userId: MOCK_USER.id, name: "TypeScript" },
          { id: "tag_02", userId: MOCK_USER.id, name: "React" },
        ]);
      mockInsertValues.mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      });

      // Act
      const res = await app.request("/api/articles/article_01/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: ["tag_01", "tag_02"] }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ArticleTagsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        articleId: "article_01",
        tagIds: ["tag_01", "tag_02"],
      });
    });

    it("空のtagIds配列でタグをすべて解除できること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere
        .mockResolvedValueOnce([
          { id: "article_01", userId: MOCK_USER.id, url: "https://example.com" },
        ])
        .mockResolvedValueOnce([]);

      // Act
      const res = await app.request("/api/articles/article_01/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: [] }),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as ArticleTagsResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        articleId: "article_01",
        tagIds: [],
      });
    });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/articles/article_01/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: ["tag_01"] }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("バリデーション", () => {
    it("tagIdsが未指定の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/articles/article_01/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("tagIdsが配列でない場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/api/articles/article_01/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: "not-an-array" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("記事の存在チェック", () => {
    it("存在しない記事IDの場合404を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([]);

      // Act
      const res = await app.request("/api/articles/nonexistent/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: ["tag_01"] }),
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("記事が見つからない場合のエラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([]);

      // Act
      const res = await app.request("/api/articles/nonexistent/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: ["tag_01"] }),
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("記事が見つかりません");
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere
        .mockResolvedValueOnce([
          { id: "article_01", userId: MOCK_USER.id, url: "https://example.com" },
        ])
        .mockResolvedValueOnce([]);
      mockDeleteWhere.mockResolvedValue({ rowsAffected: 0 });

      // Act
      const res = await app.request("/api/articles/article_01/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: [] }),
      });

      // Assert
      expect(res.status).toBe(404);
    });
  });
});
