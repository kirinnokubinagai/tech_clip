import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTagsRoute } from "../../src/routes/tags";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_tags_01",
  email: "tags@example.com",
  name: "タグテストユーザー",
};

/** テスト用タグデータ */
const MOCK_TAGS = [
  {
    id: "tag_001",
    userId: MOCK_USER.id,
    name: "TypeScript",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "tag_002",
    userId: MOCK_USER.id,
    name: "React",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
  },
];

/** テスト用記事データ */
const MOCK_ARTICLE = {
  id: "article_tags_001",
  userId: MOCK_USER.id,
  url: "https://example.com/article",
  title: "テスト記事",
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

/** タグレスポンスの型定義 */
type TagResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
};

/** タグ一覧レスポンスの型定義 */
type TagsListResponse = {
  success: boolean;
  data: Array<Record<string, unknown>>;
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
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue([]),
  };
}

/**
 * テスト用アプリを生成する
 *
 * @param mockDb - モックDBオブジェクト
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(mockDb: ReturnType<typeof createMockDb>, authenticated = true) {
  const route = createTagsRoute({
    db: mockDb as unknown as Parameters<typeof createTagsRoute>[0]["db"],
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

describe("タグAPI 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe("POST /tags", () => {
    it("タグを作成できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);
      mockDb.returning.mockResolvedValue([MOCK_TAGS[0]]);
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as TagResponse;

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("タグ名が空の場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("重複タグ名の場合に409エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([MOCK_TAGS[0]]);
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TypeScript" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_CONFLICT);
      expect(body.error.code).toBe("DUPLICATE");
    });
  });

  describe("GET /tags", () => {
    it("認証済みユーザーのタグ一覧を取得できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValue(MOCK_TAGS);
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/tags");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as TagsListResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/tags");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("DELETE /tags/:id", () => {
    it("自分のタグを削除できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([MOCK_TAGS[0]]);
      const app = createTestApp(mockDb);
      const req = new Request(`http://localhost/tags/${MOCK_TAGS[0].id}`, {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_NO_CONTENT);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/tags/tag_001", {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しないタグの場合に404エラーを返すこと", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/tags/nonexistent_tag", {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PUT /articles/:id/tags", () => {
    it("記事にタグを設定できること", async () => {
      // Arrange
      mockDb.where.mockResolvedValue([MOCK_ARTICLE]);
      const app = createTestApp(mockDb);
      const req = new Request(`http://localhost/articles/${MOCK_ARTICLE.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: [MOCK_TAGS[0].id] }),
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/articles/article_001/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: [] }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("tagIdsが配列でない場合に422エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/articles/article_001/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: "not-an-array" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });
});
