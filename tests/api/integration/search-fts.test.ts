import path from "node:path";

import { articles } from "@api/db/schema/articles";
import { users } from "@api/db/schema/users";
import { buildFtsMatchExpression, getShortTokens } from "@api/routes/search";
import { createClient } from "@libsql/client";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Drizzle マイグレーションファイルのフォルダパスを返す
 *
 * @returns apps/api/drizzle ディレクトリの絶対パス
 */
function getDrizzleMigrationsFolder(): string {
  return path.resolve(import.meta.dirname, "../../../apps/api/drizzle");
}

/** テスト用ユーザー1 */
const TEST_USER_1 = {
  id: "user_fts_01",
  name: "FTSテストユーザー1",
  email: "fts1@example.com",
  emailVerified: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** テスト用ユーザー2 */
const TEST_USER_2 = {
  id: "user_fts_02",
  name: "FTSテストユーザー2",
  email: "fts2@example.com",
  emailVerified: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/** テスト用記事の基本データ */
const ARTICLE_BASE = {
  url: "https://example.com/article",
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

/**
 * FTS MATCH クエリを実行し、ユーザースコープで絞り込む（3文字以上のトークン向け）
 */
async function searchArticlesByFts(
  db: ReturnType<typeof drizzle>,
  userId: string,
  matchExpr: string | null,
) {
  if (matchExpr === null) {
    return [];
  }
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

/**
 * 短いトークン（2文字以下）を含むクエリのフル FTS 検索
 * articles-subapp の searchQueryFn と同等のロジック
 */
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

describe("FTS5 全文検索 統合テスト", () => {
  let db: ReturnType<typeof drizzle>;
  let client: ReturnType<typeof createClient>;

  beforeAll(async () => {
    client = createClient({ url: ":memory:" });
    db = drizzle(client);

    await migrate(db, {
      migrationsFolder: getDrizzleMigrationsFolder(),
    });

    await db.insert(users).values([TEST_USER_1, TEST_USER_2]);
  });

  afterAll(async () => {
    client.close();
  });

  describe("INSERT後のFTS同期", () => {
    it("記事をINSERTした直後にMATCHクエリでヒットすること", async () => {
      // Arrange
      const articleId = "article_fts_insert_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/react-hooks",
        title: "React hooks完全ガイド",
        content: "useStateとuseEffectの使い方",
        excerpt: "React hooksの基本",
      });

      // Act
      const matchExpr = buildFtsMatchExpression("React");
      const results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });

    it("複数語AND検索で全トークンを含む記事のみヒットすること", async () => {
      // Arrange
      const article1Id = "article_fts_multi_01";
      const article2Id = "article_fts_multi_02";
      await db.insert(articles).values([
        {
          ...ARTICLE_BASE,
          id: article1Id,
          userId: TEST_USER_1.id,
          url: "https://example.com/ts-advanced",
          title: "TypeScript advanced patterns",
          content: "TypeScriptの高度なパターン",
          excerpt: "TypeScript advanced",
        },
        {
          ...ARTICLE_BASE,
          id: article2Id,
          userId: TEST_USER_1.id,
          url: "https://example.com/ts-basic",
          title: "TypeScript基礎",
          content: "TypeScriptの基礎知識",
          excerpt: "TypeScript入門",
        },
      ]);

      // Act: "TypeScript" AND "advanced" の両方を含む記事のみヒット
      const matchExpr = buildFtsMatchExpression("TypeScript advanced");
      const results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert: article1はヒット、article2はヒットしない
      const ids = results.map((r) => r.id);
      expect(ids).toContain(article1Id);
      expect(ids).not.toContain(article2Id);
    });
  });

  describe("UPDATE後のFTS同期", () => {
    it("記事をUPDATEした後、古いタイトルではヒットせず新しいタイトルでヒットすること", async () => {
      // Arrange
      const articleId = "article_fts_update_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/update-test",
        title: "OldTitle検索テスト",
        content: "更新テスト用記事本文",
        excerpt: "更新テスト",
      });

      // Act: タイトルを更新
      await db
        .update(articles)
        .set({ title: "NewTitle更新後テスト", updatedAt: new Date() })
        .where(eq(articles.id, articleId));

      // Assert: 古いタイトルではヒットしない
      const oldMatchExpr = buildFtsMatchExpression("OldTitle");
      const oldResults = await searchArticlesByFts(db, TEST_USER_1.id, oldMatchExpr);
      expect(oldResults.some((r) => r.id === articleId)).toBe(false);

      // Assert: 新しいタイトルでヒットする
      const newMatchExpr = buildFtsMatchExpression("NewTitle");
      const newResults = await searchArticlesByFts(db, TEST_USER_1.id, newMatchExpr);
      expect(newResults.some((r) => r.id === articleId)).toBe(true);
    });
  });

  describe("DELETE後のFTS同期", () => {
    it("記事をDELETEした後にMATCHクエリでヒットしないこと", async () => {
      // Arrange
      const articleId = "article_fts_delete_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/delete-test",
        title: "DeleteTarget削除テスト記事",
        content: "削除テスト用本文",
        excerpt: "削除テスト",
      });

      // 削除前はヒットすることを確認
      const matchExpr = buildFtsMatchExpression("DeleteTarget");
      const beforeResults = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);
      expect(beforeResults.some((r) => r.id === articleId)).toBe(true);

      // Act
      await db.delete(articles).where(eq(articles.id, articleId));

      // Assert
      const afterResults = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);
      expect(afterResults.some((r) => r.id === articleId)).toBe(false);
    });
  });

  describe("ユーザースコープ絞り込み", () => {
    it("別ユーザーの記事はヒットしないこと", async () => {
      // Arrange
      const user1ArticleId = "article_fts_scope_01";
      const user2ArticleId = "article_fts_scope_02";
      const uniqueKeyword = "UniqueKeywordForScope";

      await db.insert(articles).values([
        {
          ...ARTICLE_BASE,
          id: user1ArticleId,
          userId: TEST_USER_1.id,
          url: "https://example.com/scope-user1",
          title: `${uniqueKeyword} ユーザー1の記事`,
          content: "ユーザー1の本文",
          excerpt: "ユーザー1の概要",
        },
        {
          ...ARTICLE_BASE,
          id: user2ArticleId,
          userId: TEST_USER_2.id,
          url: "https://example.com/scope-user2",
          title: `${uniqueKeyword} ユーザー2の記事`,
          content: "ユーザー2の本文",
          excerpt: "ユーザー2の概要",
        },
      ]);

      // Act: ユーザー1のスコープで検索
      const matchExpr = buildFtsMatchExpression(uniqueKeyword);
      const user1Results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert: ユーザー1の記事のみヒット
      const ids = user1Results.map((r) => r.id);
      expect(ids).toContain(user1ArticleId);
      expect(ids).not.toContain(user2ArticleId);
    });
  });

  describe("trigram部分一致検索の動作", () => {
    it("trigramにより英語の部分文字列でヒットすること", async () => {
      // Arrange
      const articleId = "article_fts_trigram_en_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/trigram-en-test",
        title: "React Framework",
        content: "Reactの仕組みを解説",
        excerpt: "React解説",
      });

      // Act: "eac" は "React" の部分文字列（3文字）— trigram でヒットする
      const matchExpr = buildFtsMatchExpression("eac");
      const results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert: trigram では3文字以上の部分文字列でヒットする
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });

    it("trigramにより日本語の部分一致が機能すること", async () => {
      // Arrange
      const articleId = "article_fts_trigram_ja_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/trigram-ja-test",
        title: "機械学習フレームワーク入門",
        content: "機械学習の基礎を解説します",
        excerpt: "機械学習入門",
      });

      // Act: "機械学" (3文字) は "機械学習フレームワーク入門" の部分文字列
      const matchExpr = buildFtsMatchExpression("機械学");
      const results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert: unicode61では不可能だったスペースなし日本語の部分一致がhitする
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });

    it("AI(2文字)でvocab lookup経由でヒットすること", async () => {
      // Arrange
      const articleId = "article_fts_trigram_ai_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/trigram-ai-test",
        title: "AI技術の最前線",
        content: "人工知能AIの最新動向",
        excerpt: "AI解説",
      });

      // Act: "AI" は2文字 → vocab lookup → fts5vocab で "AI技" などを取得して MATCH
      const results = await searchArticlesFullFts(db, TEST_USER_1.id, "AI");

      // Assert: パディング付き trigram 経由でヒット
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });

    it("Go(2文字)でGo言語の記事がヒットすること", async () => {
      // Arrange
      const articleId = "article_fts_trigram_go_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/trigram-go-test",
        title: "Go言語入門",
        content: "Goプログラミング言語の基礎を解説します",
        excerpt: "Go入門",
      });

      // Act: "Go" は2文字 → vocab lookup → "Go言" など → MATCH
      const results = await searchArticlesFullFts(db, TEST_USER_1.id, "Go");

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });
  });

  describe("INSERTトリガーによるFTS同期確認", () => {
    it("INSERTトリガーにより挿入した記事がFTSで検索できること", async () => {
      // Arrange
      const articleId = "article_fts_trigger_insert_01";
      const uniqueKeyword = "TriggerSyncKeyword";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/trigger-sync-test",
        title: `${uniqueKeyword} INSERTトリガー確認`,
        content: "INSERTトリガーによるFTS同期確認用本文",
        excerpt: "INSERTトリガー確認",
      });

      // Act
      const matchExpr = buildFtsMatchExpression(uniqueKeyword);
      const results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert
      expect(results.some((r) => r.id === articleId)).toBe(true);
    });
  });

  describe("カーソルページネーション", () => {
    it("cursorを指定してFTS検索でページネーションできること", async () => {
      // Arrange: 複数の記事をINSERT
      const baseTime = new Date("2024-06-01");
      const articleIds = ["article_page_01", "article_page_02", "article_page_03"];
      for (let i = 0; i < articleIds.length; i++) {
        await db.insert(articles).values({
          ...ARTICLE_BASE,
          id: articleIds[i],
          userId: TEST_USER_1.id,
          url: `https://example.com/page-${i}`,
          title: `PaginationKeyword記事 ${i + 1}`,
          content: `ページネーションテスト本文 ${i + 1}`,
          excerpt: `ページネーション ${i + 1}`,
          createdAt: new Date(baseTime.getTime() - i * 1000),
          updatedAt: new Date(baseTime.getTime() - i * 1000),
        });
      }

      // Act: cursor付きで検索
      const matchExpr = buildFtsMatchExpression("PaginationKeyword");
      const allResults = await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.userId, TEST_USER_1.id),
            sql`articles.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ${matchExpr})`,
          ),
        )
        .orderBy(desc(articles.createdAt))
        .limit(2);

      expect(allResults.length).toBe(2);

      // cursor以降を取得
      const cursor = allResults[allResults.length - 1].id;
      const nextResults = await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.userId, TEST_USER_1.id),
            sql`articles.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ${matchExpr})`,
            lt(articles.id, cursor),
          ),
        )
        .orderBy(desc(articles.createdAt));

      // Assert: cursor以降の記事が取得できる
      expect(nextResults.length).toBeGreaterThanOrEqual(1);
    });
  });
});
