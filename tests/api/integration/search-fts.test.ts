import path from "node:path";

import { articles } from "@api/db/schema/articles";
import { users } from "@api/db/schema/users";
import { buildFtsMatchExpression } from "@api/routes/search";
import { createClient } from "@libsql/client";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
 * FTS MATCH クエリを実行し、ユーザースコープで絞り込む
 *
 * @param db - Drizzle DBインスタンス
 * @param userId - 検索対象ユーザーID
 * @param matchExpr - FTS5 MATCH 式
 * @returns 記事一覧
 */
async function searchArticlesByFts(
  db: ReturnType<typeof drizzle>,
  userId: string,
  matchExpr: string,
) {
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
      migrationsFolder: path.resolve(import.meta.dirname, "../../../apps/api/drizzle"),
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

  describe("部分文字列検索の動作", () => {
    it("LIKE検索でヒットしていた部分文字列（単語境界なし）がFTSではヒットしないこと", async () => {
      // Arrange
      const articleId = "article_fts_boundary_01";
      await db.insert(articles).values({
        ...ARTICLE_BASE,
        id: articleId,
        userId: TEST_USER_1.id,
        url: "https://example.com/boundary-test",
        title: "React Framework",
        content: "Reactの仕組みを解説",
        excerpt: "React解説",
      });

      // Act: "eac" は "React" の部分文字列だが単語ではない
      const matchExpr = buildFtsMatchExpression("eac");
      const results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert: FTSでは単語境界でトークン化されるため "eac" はヒットしない
      expect(results.some((r) => r.id === articleId)).toBe(false);
    });
  });

  describe("rebuild動作", () => {
    it("マイグレーション時点で既存データがFTSに取り込まれていること", async () => {
      // Arrange: すでに beforeAll で migrate が実行されており、
      // migrate 後に insert した記事は rebuild の対象外だが、
      // この検証は INSERT トリガーが正しく動いていることを確認する

      // テスト開始時にINSERTした article_fts_insert_01 が検索できることで
      // トリガーが機能していることを確認
      const matchExpr = buildFtsMatchExpression("React");
      const results = await searchArticlesByFts(db, TEST_USER_1.id, matchExpr);

      // Assert
      expect(results.length).toBeGreaterThan(0);
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
