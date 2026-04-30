/**
 * 記事クリティカルパス統合テスト
 *
 * 記事保存 → 一覧取得 → 詳細取得 → 削除 のフローを
 * インメモリ SQLite + 実 Hono アプリ (app.request) で検証する。
 */

import { articles, sessions, summaries, translations, users } from "@api/db/schema/index";
import { createArticlesRoute } from "@api/routes/articles";
import { createClient } from "@libsql/client";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** テスト用固定値 */
const TEST_USER_ID = "user_articles_e2e_01";
const TEST_USER_ID_2 = "user_articles_e2e_02";
const TEST_TOKEN = "articles-e2e-session-token";
const TEST_URL = "https://example.com/article/1";
const TEST_URL_2 = "https://example.com/article/2";

/** インメモリ SQLite DB を作成する */
function createTestDb() {
  const client = createClient({ url: "file::memory:" });
  return drizzle(client);
}

/** DDL 文を実行してテーブルを初期化する */
async function initTables(db: ReturnType<typeof createTestDb>) {
  await db.run(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, image TEXT, email_verified INTEGER DEFAULT 0, username TEXT UNIQUE, bio TEXT, website_url TEXT, github_username TEXT, twitter_username TEXT, avatar_url TEXT, is_profile_public INTEGER DEFAULT 1, preferred_language TEXT DEFAULT 'ja', is_premium INTEGER DEFAULT 0, premium_expires_at TEXT, free_ai_uses_remaining INTEGER DEFAULT 5, free_ai_reset_at TEXT, push_token TEXT, push_enabled INTEGER DEFAULT 1, is_test_account INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  await db.run(
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  await db.run(
    "CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, url TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL, author TEXT, content TEXT, excerpt TEXT, thumbnail_url TEXT, reading_time_minutes INTEGER, is_read INTEGER DEFAULT 0, is_favorite INTEGER DEFAULT 0, is_public INTEGER DEFAULT 0, published_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(user_id, url))",
  );
  await db.run("CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id)");
  await db.run(
    "CREATE TABLE IF NOT EXISTS summaries (id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE, language TEXT NOT NULL, summary TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(article_id, language))",
  );
  await db.run(
    "CREATE TABLE IF NOT EXISTS translations (id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE, target_language TEXT NOT NULL, translated_title TEXT NOT NULL, translated_content TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(article_id, target_language))",
  );
}

/** テスト用シードデータを挿入する */
async function seedUsers(db: ReturnType<typeof createTestDb>) {
  await db.insert(users).values([
    { id: TEST_USER_ID, email: "articles-e2e@example.com", name: "記事E2Eユーザー" },
    { id: TEST_USER_ID_2, email: "articles-e2e2@example.com", name: "記事E2Eユーザー2" },
  ]);
  await db.insert(sessions).values({
    id: "session_articles_e2e_01",
    userId: TEST_USER_ID,
    token: TEST_TOKEN,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
}

/** モック記事パーサーを生成する */
function createMockParser(
  overrides?: Partial<{
    title: string;
    source: string;
    content: string;
    excerpt: string;
    author: string;
  }>,
) {
  return vi.fn().mockResolvedValue({
    title: overrides?.title ?? "テスト記事タイトル",
    source: overrides?.source ?? "example.com",
    content: overrides?.content ?? "記事本文テキスト",
    excerpt: overrides?.excerpt ?? "記事の抜粋テキスト",
    author: overrides?.author ?? "テスト著者",
    thumbnailUrl: null,
    readingTimeMinutes: 3,
    publishedAt: null,
  });
}

/** テスト用 Hono アプリを構築する */
function buildTestApp(
  db: ReturnType<typeof createTestDb>,
  parseArticleFn: ReturnType<typeof createMockParser>,
  authenticatedUserId?: string,
) {
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  const userId = authenticatedUserId ?? TEST_USER_ID;

  const articlesRoute = createArticlesRoute({
    db: db as never,
    parseArticleFn,
    queryFn: async (params) => {
      const conditions = [eq(articles.userId, params.userId)];
      if (params.cursor) {
        try {
          const cur = JSON.parse(Buffer.from(params.cursor, "base64url").toString()) as {
            createdAt: string;
            id: string;
          };
          const cursorDate = new Date(cur.createdAt);
          conditions.push(
            or(
              lt(articles.createdAt, cursorDate),
              and(sql`${articles.createdAt} = ${cursorDate}`, lt(articles.id, cur.id)),
            ) as ReturnType<typeof and>,
          );
        } catch {
          conditions.push(lt(articles.id, params.cursor));
        }
      }
      const results = await (db as never as ReturnType<typeof drizzle>)
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.createdAt), desc(articles.id))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
  });

  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();
  subApp.use("*", async (c, next) => {
    c.set("user", { id: userId, email: "articles-e2e@example.com", name: "記事E2Eユーザー" });
    await next();
  });
  subApp.route("/api/articles", articlesRoute);

  app.route("/", subApp);
  return app;
}

/** 未認証テスト用 Hono アプリを構築する */
function buildUnauthenticatedApp(
  db: ReturnType<typeof createTestDb>,
  parseArticleFn: ReturnType<typeof createMockParser>,
) {
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  const articlesRoute = createArticlesRoute({
    db: db as never,
    parseArticleFn,
    queryFn: async () => [],
  });

  app.route("/api/articles", articlesRoute);
  return app;
}

describe("E2E: 記事クリティカルパス", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    db = createTestDb();
    await initTables(db);
    await seedUsers(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("記事保存 (POST /api/articles)", () => {
    describe("正常系", () => {
      it("有効なURLで記事を保存できること", async () => {
        // Arrange
        const mockParser = createMockParser();
        const app = buildTestApp(db, mockParser);

        // Act
        const res = await app.request("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: TEST_URL }),
        });

        // Assert
        expect(res.status).toBe(HTTP_CREATED);
        const body = (await res.json()) as {
          success: true;
          data: { id: string; url: string; title: string; source: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.url).toBe(TEST_URL);
        expect(body.data.title).toBe("テスト記事タイトル");
        expect(body.data.source).toBe("example.com");
      });
    });

    describe("異常系", () => {
      it("URLが不正な場合422が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "not-a-valid-url" }),
        });

        // Assert
        expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("VALIDATION_FAILED");
      });

      it("同じURLを重複して保存しようとすると409が返ること", async () => {
        // Arrange
        const mockParser = createMockParser();
        const app = buildTestApp(db, mockParser);

        // Act: 1回目は成功
        const firstRes = await app.request("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: TEST_URL }),
        });
        expect(firstRes.status).toBe(HTTP_CREATED);

        // Act: 2回目は重複エラー
        const secondRes = await app.request("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: TEST_URL }),
        });

        // Assert
        expect(secondRes.status).toBe(HTTP_CONFLICT);
        const body = (await secondRes.json()) as {
          success: false;
          error: { code: string; message: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("DUPLICATE");
        expect(body.error.message).toContain("すでに保存");
      });

      it("未認証の場合401が返ること", async () => {
        // Arrange
        const app = buildUnauthenticatedApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: TEST_URL }),
        });

        // Assert
        expect(res.status).toBe(HTTP_UNAUTHORIZED);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("AUTH_REQUIRED");
      });
    });
  });

  describe("記事一覧取得 (GET /api/articles)", () => {
    describe("正常系", () => {
      it("保存した記事一覧を取得できること", async () => {
        // Arrange: 2件記事を事前挿入
        const now = new Date();
        await db.insert(articles).values([
          {
            id: "article_e2e_01",
            userId: TEST_USER_ID,
            url: TEST_URL,
            source: "example.com",
            title: "記事1",
            isRead: false,
            isFavorite: false,
            isPublic: false,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "article_e2e_02",
            userId: TEST_USER_ID,
            url: TEST_URL_2,
            source: "example.com",
            title: "記事2",
            isRead: false,
            isFavorite: false,
            isPublic: false,
            createdAt: new Date(now.getTime() - 1000),
            updatedAt: new Date(now.getTime() - 1000),
          },
        ]);
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles", { method: "GET" });

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: Array<{ id: string; title: string }>;
          meta: { nextCursor: string | null; hasNext: boolean };
        };
        expect(body.success).toBe(true);
        expect(body.data.length).toBe(2);
        expect(body.meta.hasNext).toBe(false);
        expect(body.meta.nextCursor).toBeNull();
      });

      it("記事が0件の場合は空配列が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles", { method: "GET" });

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: unknown[];
          meta: { hasNext: boolean };
        };
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(0);
        expect(body.meta.hasNext).toBe(false);
      });

      it("記事一覧に content フィールドが含まれないこと", async () => {
        // Arrange
        const now = new Date();
        await db.insert(articles).values({
          id: "article_e2e_content_check",
          userId: TEST_USER_ID,
          url: TEST_URL,
          source: "example.com",
          title: "コンテンツ除外チェック記事",
          content: "これは除外されるコンテンツ",
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles", { method: "GET" });

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: Array<Record<string, unknown>>;
        };
        expect(body.data[0]).not.toHaveProperty("content");
      });

      it("未認証の場合401が返ること", async () => {
        // Arrange
        const app = buildUnauthenticatedApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles", { method: "GET" });

        // Assert
        expect(res.status).toBe(HTTP_UNAUTHORIZED);
      });
    });
  });

  describe("記事詳細取得 (GET /api/articles/:id)", () => {
    describe("正常系", () => {
      it("保存した記事の詳細を取得できること", async () => {
        // Arrange
        const now = new Date();
        await db.insert(articles).values({
          id: "article_e2e_detail_01",
          userId: TEST_USER_ID,
          url: TEST_URL,
          source: "example.com",
          title: "詳細テスト記事",
          content: "詳細記事の本文",
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles/article_e2e_detail_01", {
          method: "GET",
        });

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: { id: string; title: string; content: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.id).toBe("article_e2e_detail_01");
        expect(body.data.title).toBe("詳細テスト記事");
        expect(body.data.content).toBe("詳細記事の本文");
      });

      it("language と targetLanguage に対応する要約と翻訳を取得できること", async () => {
        // Arrange
        const now = new Date();
        await db.insert(articles).values({
          id: "article_e2e_detail_lang_01",
          userId: TEST_USER_ID,
          url: `${TEST_URL}/lang`,
          source: "example.com",
          title: "多言語記事",
          content: "多言語記事の本文",
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        await db.insert(summaries).values({
          id: "summary_e2e_lang_01",
          articleId: "article_e2e_detail_lang_01",
          language: "en",
          summary: "English summary",
          model: "gemma-4-27b-it",
          createdAt: now,
        });
        await db.insert(translations).values({
          id: "translation_e2e_lang_01",
          articleId: "article_e2e_detail_lang_01",
          targetLanguage: "ko",
          translatedTitle: "다국어 기사",
          translatedContent: "한국어 번역 본문",
          model: "gemma-4-27b-it",
          createdAt: now,
        });
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request(
          "/api/articles/article_e2e_detail_lang_01?language=en&targetLanguage=ko",
          {
            method: "GET",
          },
        );

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: { summary: string | null; translation: string | null };
        };
        expect(body.success).toBe(true);
        expect(body.data.summary).toBe("English summary");
        expect(body.data.translation).toBe("한국어 번역 본문");
      });
    });

    describe("異常系", () => {
      it("存在しない記事IDの場合404が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles/nonexistent-id-xyz", {
          method: "GET",
        });

        // Assert
        expect(res.status).toBe(HTTP_NOT_FOUND);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("NOT_FOUND");
      });

      it("他ユーザーの記事にアクセスすると403が返ること", async () => {
        // Arrange: ユーザー2の記事を挿入
        const now = new Date();
        await db.insert(articles).values({
          id: "article_e2e_other_user",
          userId: TEST_USER_ID_2,
          url: TEST_URL,
          source: "example.com",
          title: "他ユーザーの記事",
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        const app = buildTestApp(db, createMockParser(), TEST_USER_ID);

        // Act
        const res = await app.request("/api/articles/article_e2e_other_user", {
          method: "GET",
        });

        // Assert
        expect(res.status).toBe(403);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("FORBIDDEN");
      });
    });
  });

  describe("記事削除 (DELETE /api/articles/:id)", () => {
    describe("正常系", () => {
      it("保存した記事を削除できること", async () => {
        // Arrange
        const now = new Date();
        await db.insert(articles).values({
          id: "article_e2e_delete_01",
          userId: TEST_USER_ID,
          url: TEST_URL,
          source: "example.com",
          title: "削除テスト記事",
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles/article_e2e_delete_01", {
          method: "DELETE",
        });

        // Assert
        expect(res.status).toBe(HTTP_NO_CONTENT);
      });

      it("削除後に同じ記事を取得すると404が返ること", async () => {
        // Arrange
        const now = new Date();
        await db.insert(articles).values({
          id: "article_e2e_delete_check",
          userId: TEST_USER_ID,
          url: TEST_URL,
          source: "example.com",
          title: "削除後確認記事",
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        const app = buildTestApp(db, createMockParser());

        // Act: 削除
        const deleteRes = await app.request("/api/articles/article_e2e_delete_check", {
          method: "DELETE",
        });
        expect(deleteRes.status).toBe(HTTP_NO_CONTENT);

        // Act: 削除後に取得
        const getRes = await app.request("/api/articles/article_e2e_delete_check", {
          method: "GET",
        });

        // Assert
        expect(getRes.status).toBe(HTTP_NOT_FOUND);
      });
    });

    describe("異常系", () => {
      it("存在しない記事を削除しようとすると404が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockParser());

        // Act
        const res = await app.request("/api/articles/nonexistent-delete-id", {
          method: "DELETE",
        });

        // Assert
        expect(res.status).toBe(HTTP_NOT_FOUND);
      });

      it("他ユーザーの記事を削除しようとすると403が返ること", async () => {
        // Arrange
        const now = new Date();
        await db.insert(articles).values({
          id: "article_e2e_forbidden_delete",
          userId: TEST_USER_ID_2,
          url: TEST_URL,
          source: "example.com",
          title: "他ユーザーの削除禁止記事",
          isRead: false,
          isFavorite: false,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        const app = buildTestApp(db, createMockParser(), TEST_USER_ID);

        // Act
        const res = await app.request("/api/articles/article_e2e_forbidden_delete", {
          method: "DELETE",
        });

        // Assert
        expect(res.status).toBe(403);
      });
    });
  });

  describe("E2E フロー: 記事保存 → 一覧取得 → 詳細取得 → 削除", () => {
    it("記事操作の一連のフローが成功すること", async () => {
      // Arrange
      const mockParser = createMockParser({ title: "E2Eフロー記事", source: "example.com" });
      const app = buildTestApp(db, mockParser);

      // Act: Step 1 - 記事保存
      const saveRes = await app.request("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: TEST_URL }),
      });
      expect(saveRes.status).toBe(HTTP_CREATED);
      const saveBody = (await saveRes.json()) as {
        success: true;
        data: { id: string; title: string };
      };
      const articleId = saveBody.data.id;
      expect(saveBody.data.title).toBe("E2Eフロー記事");

      // Act: Step 2 - 一覧取得（保存した記事が含まれること）
      const listRes = await app.request("/api/articles", { method: "GET" });
      expect(listRes.status).toBe(HTTP_OK);
      const listBody = (await listRes.json()) as {
        success: true;
        data: Array<{ id: string }>;
      };
      expect(listBody.data.some((a) => a.id === articleId)).toBe(true);

      // Act: Step 3 - 詳細取得
      const detailRes = await app.request(`/api/articles/${articleId}`, {
        method: "GET",
      });
      expect(detailRes.status).toBe(HTTP_OK);
      const detailBody = (await detailRes.json()) as {
        success: true;
        data: { id: string; url: string };
      };
      expect(detailBody.data.id).toBe(articleId);
      expect(detailBody.data.url).toBe(TEST_URL);

      // Act: Step 4 - 削除
      const deleteRes = await app.request(`/api/articles/${articleId}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(HTTP_NO_CONTENT);

      // Assert: 削除後に取得すると404
      const afterDeleteRes = await app.request(`/api/articles/${articleId}`, {
        method: "GET",
      });
      expect(afterDeleteRes.status).toBe(HTTP_NOT_FOUND);
    });
  });
});
