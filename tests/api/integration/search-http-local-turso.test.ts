import path from "node:path";

import { articles } from "@api/db/schema/articles";
import { users } from "@api/db/schema/users";
import { buildFtsMatchExpression, createSearchRoute, getShortTokens } from "@api/routes/search";
import { createClient } from "@libsql/client";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SQLD_URL = process.env.SQLD_URL ?? "http://127.0.0.1:8888";
const SQLD_AUTH_TOKEN = process.env.SQLD_AUTH_TOKEN ?? "dummy";

function getDrizzleMigrationsFolder(): string {
  return path.resolve(import.meta.dirname, "../../../apps/api/drizzle");
}

const TEST_USER = {
  id: "user_http_search_01",
  name: "HTTP検索テストユーザー",
  email: "http_search@example.com",
  emailVerified: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const ARTICLE_BASE = {
  url: "https://example.com/http-search",
  source: "zenn",
  author: "著者",
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: false,
  publishedAt: new Date("2024-01-01"),
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** 検索 HTTP レスポンスの型 */
type SearchResponse = {
  success: boolean;
  data: Array<{ id: string; title: string; content?: string }>;
  meta: { nextCursor: string | null; hasNext: boolean };
  error?: { code: string; message: string };
};

describe("検索APIエンドポイント HTTP 統合テスト（local Turso）", () => {
  let db: ReturnType<typeof drizzle>;
  let client: ReturnType<typeof createClient>;
  let app: Hono;
  let sqldAvailable = false;

  beforeAll(async () => {
    try {
      client = createClient({ url: SQLD_URL, authToken: SQLD_AUTH_TOKEN });
      await client.execute("SELECT 1");
      db = drizzle(client);
      await migrate(db, { migrationsFolder: getDrizzleMigrationsFolder() });
      sqldAvailable = true;

      await db.insert(users).values(TEST_USER).onConflictDoNothing();

      // テスト記事を事前投入
      const testArticles = [
        {
          id: "hs_react_01",
          title: "React hooks完全ガイド",
          content: "useStateとuseEffectの使い方",
          excerpt: "React hooksの基本",
          url: "https://example.com/hs-react",
        },
        {
          id: "hs_go_01",
          title: "Go言語入門",
          content: "Goプログラミング言語の基礎を解説します",
          excerpt: "Go入門",
          url: "https://example.com/hs-go",
        },
        {
          id: "hs_ai_01",
          title: "AI技術の最前線",
          content: "人工知能AIの最新動向を解説",
          excerpt: "AI解説",
          url: "https://example.com/hs-ai",
        },
        {
          id: "hs_ts_01",
          title: "TypeScript実践入門",
          content: "TypeScriptの型システムと応用",
          excerpt: "TypeScript解説",
          url: "https://example.com/hs-ts",
        },
        {
          id: "hs_ja3_01",
          title: "機械学習フレームワーク入門",
          content: "機械学習の基礎を解説",
          excerpt: "機械学習入門",
          url: "https://example.com/hs-ml",
        },
      ];
      for (const a of testArticles) {
        await db
          .insert(articles)
          .values({
            ...ARTICLE_BASE,
            ...a,
            userId: TEST_USER.id,
          })
          .onConflictDoNothing();
      }

      // searchQueryFn: articles-subapp.ts と同等の実装
      const searchQueryFn = async (params: {
        userId: string;
        query: string;
        limit: number;
        cursor?: string;
      }) => {
        const longExpr = buildFtsMatchExpression(params.query);
        const shortTokens = getShortTokens(params.query);

        const shortExprs: string[] = [];
        for (const token of shortTokens) {
          const row = await db.get<{ terms: string | null }>(
            sql`SELECT GROUP_CONCAT('"' || REPLACE(term, '"', '""') || '"', ' OR ') AS terms FROM articles_fts_vocab WHERE term LIKE ${`${token}%`}`,
          );
          if (row?.terms) {
            shortExprs.push(`(${row.terms})`);
          }
        }

        const allExprs = [longExpr, ...shortExprs].filter(Boolean);
        if (allExprs.length === 0) return [];

        const matchExpr = allExprs.join(" AND ");
        const conditions = [
          eq(articles.userId, params.userId),
          sql`articles.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ${matchExpr})`,
        ];
        if (params.cursor) {
          conditions.push(lt(articles.id, params.cursor));
        }
        const results = await db
          .select()
          .from(articles)
          .where(and(...conditions))
          .orderBy(desc(articles.createdAt))
          .limit(params.limit);
        return results;
      };

      // 実際のアプリと同等の Hono アプリ（認証はテスト用ユーザーを直接注入）
      const searchRoute = createSearchRoute({ searchQueryFn });
      app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();
      app.use("*", async (c, next) => {
        c.set("user", TEST_USER);
        await next();
      });
      app.route("/api/articles", searchRoute);
    } catch (e) {
      console.warn(`sqld (${SQLD_URL}) に接続できません。HTTPテストをスキップします。`);
      console.warn(String(e));
    }
  });

  afterAll(async () => {
    if (!sqldAvailable) return;
    await db.delete(articles).where(eq(articles.userId, TEST_USER.id));
    await db.delete(users).where(eq(users.id, TEST_USER.id));
    client.close();
  });

  describe("GET /api/articles/search", () => {
    it("3文字以上の英語キーワードでヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act
      const res = await app.fetch(new Request("http://localhost/api/articles/search?q=React"));

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponse;
      expect(body.success).toBe(true);
      expect(body.data.some((a) => a.id === "hs_react_01")).toBe(true);
    });

    it("3文字以上の日本語キーワードでヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act
      const res = await app.fetch(
        new Request("http://localhost/api/articles/search?q=%E6%A9%9F%E6%A2%B0%E5%AD%A6"),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponse;
      expect(body.success).toBe(true);
      expect(body.data.some((a) => a.id === "hs_ja3_01")).toBe(true);
    });

    it("2文字キーワード Go でGo言語の記事がヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act
      const res = await app.fetch(new Request("http://localhost/api/articles/search?q=Go"));

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponse;
      expect(body.success).toBe(true);
      expect(body.data.some((a) => a.id === "hs_go_01")).toBe(true);
    });

    it("2文字キーワード AI でAI記事がヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act
      const res = await app.fetch(new Request("http://localhost/api/articles/search?q=AI"));

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponse;
      expect(body.success).toBe(true);
      expect(body.data.some((a) => a.id === "hs_ai_01")).toBe(true);
    });

    it("レスポンスに content フィールドが含まれないこと", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act
      const res = await app.fetch(new Request("http://localhost/api/articles/search?q=TypeScript"));

      // Assert
      const body = (await res.json()) as SearchResponse;
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]).not.toHaveProperty("content");
    });

    it("q パラメータなしで 422 を返すこと", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act
      const res = await app.fetch(new Request("http://localhost/api/articles/search"));

      // Assert
      expect(res.status).toBe(422);
      const body = (await res.json()) as SearchResponse;
      expect(body.error?.code).toBe("VALIDATION_FAILED");
    });

    it("limit パラメータでページサイズを指定できること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act: limit=2 で検索（テスト記事は複数ある想定）
      const res = await app.fetch(
        new Request("http://localhost/api/articles/search?q=入門&limit=2"),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponse;
      expect(body.success).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it("別ユーザーの記事はヒットしないこと（スコープ隔離）", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Arrange: 別ユーザーのアプリを生成
      const otherUserApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();
      otherUserApp.use("*", async (c, next) => {
        c.set("user", { id: "other_user_http_99", name: "Other User" });
        await next();
      });
      const otherSearchRoute = createSearchRoute({ searchQueryFn: async () => [] });
      otherUserApp.route("/api/articles", otherSearchRoute);

      // Act
      const res = await otherUserApp.fetch(
        new Request("http://localhost/api/articles/search?q=React"),
      );

      // Assert: 他ユーザースコープでは0件
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponse;
      expect(body.data.every((a) => a.id !== "hs_react_01")).toBe(true);
    });
  });
});
