import {
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "@api/lib/http-status";
import { createAiRoute } from "@api/routes/ai";
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
  title: "React Hooksの使い方",
  author: "テスト著者",
  content: "# React Hooks\n\nテスト本文です。",
  excerpt: "テスト概要",
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: false,
  publishedAt: new Date("2024-01-15"),
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

/** テスト用の翻訳済みデータ */
const MOCK_TRANSLATION = {
  id: "translation_001",
  articleId: MOCK_ARTICLE.id,
  targetLanguage: "en",
  translatedTitle: "How to use React Hooks",
  translatedContent: "# React Hooks\n\nThis is test content.",
  model: "gemma-4-26b-a4b",
  createdAt: new Date("2024-01-15"),
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

/** 成功レスポンスの型定義 */
type SuccessResponseBody = {
  success: boolean;
  data: Record<string, unknown>;
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
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({
  returning: mockInsertReturning,
});
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

/** モックの db.update クエリ結果 */
const mockUpdateSet = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

/** モックの Workers AI */
const mockAi = {
  run: vi.fn(),
};

/** モックの translateFn */
const mockTranslateFn = vi.fn();

/**
 * 認証ありのテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createTestApp() {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("/api/articles/*", (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const aiRoute = createAiRoute({
    db: mockDb as never,
    ai: mockAi as unknown as Ai,
    translateFn: mockTranslateFn,
  });
  app.route("/api/articles", aiRoute);

  return app;
}

/**
 * 認証なしのテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createTestAppWithoutAuth() {
  const app = new Hono();

  const aiRoute = createAiRoute({
    db: mockDb as never,
    ai: mockAi as unknown as Ai,
    translateFn: mockTranslateFn,
  });
  app.route("/api/articles", aiRoute);

  return app;
}

describe("POST /api/articles/:id/translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslateFn.mockResolvedValue({
      translatedTitle: "How to use React Hooks",
      translatedContent: "# React Hooks\n\nTest content.",
      model: "gemma-4-26b-a4b",
    });
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    });
    mockInsertReturning.mockResolvedValue([MOCK_TRANSLATION]);
    mockUpdateSet.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe("認証", () => {
    it("未認証の場合401を返すこと", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("バリデーション", () => {
    it("targetLanguageが未指定の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("targetLanguageが不正な値の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "fr" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("記事の存在・所有者チェック", () => {
    it("記事が存在しない場合404を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([]);

      const req = new Request("http://localhost/api/articles/nonexistent/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("他ユーザーの記事の場合403を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([{ ...MOCK_ARTICLE, userId: "other_user" }]);

      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("キャッシュ（DB）", () => {
    it("既存の翻訳がある場合DBキャッシュから返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere
        .mockResolvedValueOnce([MOCK_ARTICLE])
        .mockResolvedValueOnce([MOCK_TRANSLATION]);

      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.translation).toMatchObject({
        articleId: MOCK_TRANSLATION.articleId,
        targetLanguage: MOCK_TRANSLATION.targetLanguage,
        translatedTitle: MOCK_TRANSLATION.translatedTitle,
        translatedContent: MOCK_TRANSLATION.translatedContent,
        model: MOCK_TRANSLATION.model,
      });
      expect(mockTranslateFn).not.toHaveBeenCalled();
    });
  });

  describe("翻訳実行", () => {
    it("新規翻訳を同期で実行して200を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("completed");
      expect(mockTranslateFn).toHaveBeenCalledOnce();
    });

    it("記事にcontentがない場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere
        .mockResolvedValueOnce([{ ...MOCK_ARTICLE, content: null }])
        .mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("翻訳APIエラー時に500を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

      mockTranslateFn.mockRejectedValue(new Error("Workers AI 翻訳エラー"));

      const req = new Request("http://localhost/api/articles/article_001/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });
  });
});

describe("POST /api/articles/:id/translate（KV キャッシュ）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslateFn.mockResolvedValue({
      translatedTitle: "How to use React Hooks",
      translatedContent: "# React Hooks\n\nTest content.",
      model: "gemma-4-26b-a4b",
    });
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    });
    mockInsertReturning.mockResolvedValue([MOCK_TRANSLATION]);
    mockUpdateSet.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("KV キャッシュヒット時に translateFn を呼び出さないこと", async () => {
    // Arrange
    const mockCache = {
      get: vi.fn().mockResolvedValue(JSON.stringify(MOCK_TRANSLATION)),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;

    type Variables = {
      user: typeof MOCK_USER;
      session: Record<string, unknown>;
    };
    const app = new Hono<{ Variables: Variables }>();
    app.use("/api/articles/*", (c, next) => {
      c.set("user", MOCK_USER);
      c.set("session", { id: "session_01" });
      return next();
    });
    const aiRoute = createAiRoute({
      db: mockDb as never,
      ai: mockAi as unknown as Ai,
      translateFn: mockTranslateFn,
      cache: mockCache,
    });
    app.route("/api/articles", aiRoute);

    mockSelectWhere.mockResolvedValue([MOCK_ARTICLE]);

    const req = new Request("http://localhost/api/articles/article_001/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "en" }),
    });

    // Act
    const res = await app.request(req);

    // Assert
    expect(res.status).toBe(HTTP_OK);
    const body = (await res.json()) as SuccessResponseBody;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("completed");
    expect(mockTranslateFn).not.toHaveBeenCalled();
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
    app.use("/api/articles/*", (c, next) => {
      c.set("user", MOCK_USER);
      c.set("session", { id: "session_01" });
      return next();
    });
    const aiRoute = createAiRoute({
      db: mockDb as never,
      ai: mockAi as unknown as Ai,
      translateFn: mockTranslateFn,
      cache: mockCache,
    });
    app.route("/api/articles", aiRoute);

    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/articles/article_001/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "en" }),
    });

    // Act
    const res = await app.request(req);

    // Assert
    expect(res.status).toBe(HTTP_OK);
    const body = (await res.json()) as SuccessResponseBody;
    expect(body.success).toBe(true);
    expect(mockTranslateFn).toHaveBeenCalledOnce();
  });

  it("KV キャッシュキーが translate:v1:<articleId>:<lang> 形式であること", async () => {
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
    app.use("/api/articles/*", (c, next) => {
      c.set("user", MOCK_USER);
      c.set("session", { id: "session_01" });
      return next();
    });
    const aiRoute = createAiRoute({
      db: mockDb as never,
      ai: mockAi as unknown as Ai,
      translateFn: mockTranslateFn,
      cache: mockCache,
    });
    app.route("/api/articles", aiRoute);

    mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/articles/article_001/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "en" }),
    });

    // Act
    await app.request(req);

    // Assert
    expect(mockCache.get).toHaveBeenCalledWith("translate:v1:article_001:en");
  });
});

describe("GET /api/articles/:id/translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証", () => {
    it("未認証の場合401を返すこと", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      const req = new Request(
        "http://localhost/api/articles/article_001/translate?targetLanguage=en",
      );

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
    });
  });

  describe("翻訳取得", () => {
    it("既存の翻訳を取得できること", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere
        .mockResolvedValueOnce([MOCK_ARTICLE])
        .mockResolvedValueOnce([MOCK_TRANSLATION]);

      const req = new Request(
        "http://localhost/api/articles/article_001/translate?targetLanguage=en",
      );

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.translatedTitle).toBe(MOCK_TRANSLATION.translatedTitle);
    });

    it("翻訳が存在しない場合404を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValueOnce([MOCK_ARTICLE]).mockResolvedValueOnce([]);

      const req = new Request(
        "http://localhost/api/articles/article_001/translate?targetLanguage=en",
      );

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("翻訳");
    });

    it("targetLanguage未指定の場合422を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      const req = new Request("http://localhost/api/articles/article_001/translate");

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
    });

    it("記事が存在しない場合404を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([]);

      const req = new Request(
        "http://localhost/api/articles/nonexistent/translate?targetLanguage=en",
      );

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
    });

    it("他ユーザーの記事の場合403を返すこと", async () => {
      // Arrange
      const app = createTestApp();
      mockSelectWhere.mockResolvedValue([{ ...MOCK_ARTICLE, userId: "other_user" }]);

      const req = new Request(
        "http://localhost/api/articles/article_001/translate?targetLanguage=en",
      );

      // Act
      const res = await app.request(req);

      // Assert
      expect(res.status).toBe(HTTP_FORBIDDEN);
    });
  });
});
