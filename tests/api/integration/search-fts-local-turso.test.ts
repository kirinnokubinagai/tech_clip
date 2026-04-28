import path from "node:path";

import { articles } from "@api/db/schema/articles";
import { users } from "@api/db/schema/users";
import { buildFtsMatchExpression, getShortTokens } from "@api/routes/search";
import { createClient } from "@libsql/client";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, it, expect } from "vitest";

const SQLD_URL = process.env.SQLD_URL ?? "http://127.0.0.1:8888";
const SQLD_AUTH_TOKEN = process.env.SQLD_AUTH_TOKEN ?? "dummy";

function getDrizzleMigrationsFolder(): string {
  return path.resolve(import.meta.dirname, "../../../apps/api/drizzle");
}

/** テスト用ユーザー（local Turso 専用プレフィックスで他テストと衝突しない） */
const TEST_USER = {
  id: "user_lt_fts_01",
  name: "Local Turso FTSテストユーザー",
  email: "lt_fts1@example.com",
  emailVerified: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const ARTICLE_BASE = {
  url: "https://example.com/lt-article",
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

/** articles-subapp の searchQueryFn と同等のフル FTS 検索（vocab lookup 込み） */
async function searchArticlesFullFts(
  db: ReturnType<typeof drizzle>,
  userId: string,
  query: string,
) {
  const longExpr = buildFtsMatchExpression(query);
  const shortTokens = getShortTokens(query);

  const shortExprs: string[] = [];
  for (const token of shortTokens) {
    const row = await db.get<{ terms: string | null }>(
      sql`SELECT GROUP_CONCAT('"' || REPLACE(term, '"', '""') || '"', ' OR ') AS terms FROM articles_fts_vocab WHERE term LIKE ${token + "%"}`,
    );
    if (row?.terms) {
      shortExprs.push(`(${row.terms})`);
    }
  }

  const allExprs = [longExpr, ...shortExprs].filter(Boolean);
  if (allExprs.length === 0) return [];

  const matchExpr = allExprs.join(" AND ");
  return await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.userId, userId),
        sql`articles.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ${matchExpr})`,
      ),
    )
    .orderBy(desc(articles.createdAt));
}

describe("Local Turso (sqld) FTS5 trigram + padding 統合テスト", () => {
  let db: ReturnType<typeof drizzle>;
  let client: ReturnType<typeof createClient>;
  let sqldAvailable = false;

  beforeAll(async () => {
    try {
      client = createClient({ url: SQLD_URL, authToken: SQLD_AUTH_TOKEN });
      await client.execute("SELECT 1");

      db = drizzle(client);
      await migrate(db, { migrationsFolder: getDrizzleMigrationsFolder() });

      sqldAvailable = true;

      // テスト用ユーザーが存在しなければ挿入（既存なら無視）
      await db
        .insert(users)
        .values(TEST_USER)
        .onConflictDoNothing();
    } catch (e) {
      console.warn(`sqld (${SQLD_URL}) に接続できません。Local Turso テストをスキップします。`);
      console.warn(String(e));
    }
  });

  afterAll(async () => {
    if (!sqldAvailable) return;
    // テストデータを削除
    await db.delete(articles).where(eq(articles.userId, TEST_USER.id));
    await db.delete(users).where(eq(users.id, TEST_USER.id));
    client.close();
  });

  describe("3文字以上のキーワード（通常 trigram）", () => {
    it("英語キーワードでヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Arrange
      const articleId = "lt_article_react_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER.id,
        url: "https://example.com/lt-react",
        title: "React hooks完全ガイド",
        content: "useStateとuseEffectの使い方",
        excerpt: "React hooksの基本",
      }).onConflictDoNothing();

      // Act
      const results = await searchArticlesFullFts(db, TEST_USER.id, "React");

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });

    it("日本語3文字でヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Arrange
      const articleId = "lt_article_ja3_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER.id,
        url: "https://example.com/lt-ml",
        title: "機械学習フレームワーク入門",
        content: "機械学習の基礎を解説",
        excerpt: "機械学習入門",
      }).onConflictDoNothing();

      // Act: "機械学"（3文字）で部分一致
      const results = await searchArticlesFullFts(db, TEST_USER.id, "機械学");

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });
  });

  describe("2文字キーワード（vocab lookup 経由）", () => {
    it("Go(2文字)でGo言語の記事がヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Arrange
      const articleId = "lt_article_go_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER.id,
        url: "https://example.com/lt-go",
        title: "Go言語入門",
        content: "Goプログラミング言語の基礎を解説します",
        excerpt: "Go入門",
      }).onConflictDoNothing();

      // Act: vocab lookup → "Go言" などの trigram を OR 連結 → MATCH
      const results = await searchArticlesFullFts(db, TEST_USER.id, "Go");

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });

    it("AI(2文字)でAI技術の記事がヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Arrange
      const articleId = "lt_article_ai_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER.id,
        url: "https://example.com/lt-ai",
        title: "AI技術の最前線",
        content: "人工知能AIの最新動向を解説",
        excerpt: "AI解説",
      }).onConflictDoNothing();

      // Act
      const results = await searchArticlesFullFts(db, TEST_USER.id, "AI");

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });

    it("JS(2文字)でJavaScript記事がヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Arrange
      const articleId = "lt_article_js_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER.id,
        url: "https://example.com/lt-js",
        title: "JS最新動向2024",
        content: "JavaScriptとJSエコシステムの解説",
        excerpt: "JS解説",
      }).onConflictDoNothing();

      // Act
      const results = await searchArticlesFullFts(db, TEST_USER.id, "JS");

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });
  });

  describe("混在クエリ（短いトークン + 長いトークン）", () => {
    it("'Go 言語'でGo言語の記事がヒットすること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Arrange: "lt_article_go_01" は "Go言語入門" で既にINSERT済み
      const results = await searchArticlesFullFts(db, TEST_USER.id, "Go 言語");

      // Assert: "Go"(vocab lookup) AND "言語"(直接 trigram) の両方を満たす記事がヒット
      expect(results.some((r) => r.id === "lt_article_go_01")).toBe(true);
    });
  });

  describe("ユーザースコープ絶縁", () => {
    it("別ユーザーのGoの記事はヒットしないこと", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Assert: TEST_USER.id のスコープで "Go" を検索しても、他ユーザーの記事は含まれない
      const results = await searchArticlesFullFts(db, "other_user_lt_99", "Go");
      expect(results.every((r) => r.userId === "other_user_lt_99")).toBe(true);
    });
  });

  describe("fts5vocab テーブルの確認", () => {
    it("vocab テーブルに 'Go' で始まる trigram が存在すること", async (ctx) => {
      if (!sqldAvailable) return ctx.skip();

      // Act: vocab テーブルから "Go" で始まる trigram を取得
      const rows = await db.all<{ term: string }>(
        sql`SELECT term FROM articles_fts_vocab WHERE term LIKE ${"Go%"} LIMIT 5`,
      );

      // Assert: パディングにより "go言" 等が存在する（FTS5 trigram は小文字化して格納）
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.term.toLowerCase().startsWith("go"))).toBe(true);
    });
  });
});
