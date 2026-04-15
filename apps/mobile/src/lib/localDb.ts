import type { SQLiteDatabase } from "expo-sqlite";
import { openDatabaseAsync } from "expo-sqlite";

import type { ArticleDetail, ArticleListItem } from "@/types/article";

/** ローカルDBファイル名 */
const DB_NAME = "techclip.db";

/** DBインスタンス（シングルトン） */
let db: SQLiteDatabase | null = null;

/**
 * articlesテーブルのローカルコピー行
 */
type ArticleRow = {
  id: string;
  title: string;
  author: string | null;
  source: string;
  published_at: string | null;
  excerpt: string | null;
  thumbnail_url: string | null;
  url: string;
  is_favorite: number;
  content?: string | null;
  is_read?: number;
  reading_time_minutes?: number | null;
  created_at?: string;
  updated_at?: string;
  summary?: string | null;
  translation?: string | null;
};

/**
 * ローカルSQLiteデータベースを初期化する
 * articles, summaries, translations テーブルを作成する
 */
export async function initLocalDb(): Promise<void> {
  if (db !== null) {
    return;
  }

  db = await openDatabaseAsync(DB_NAME);

  await db.execAsync("PRAGMA foreign_keys = ON");

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      source TEXT NOT NULL,
      published_at TEXT,
      excerpt TEXT,
      thumbnail_url TEXT,
      url TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      content TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      reading_time_minutes INTEGER,
      created_at TEXT,
      updated_at TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS summaries (
      article_id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`,
  );

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS translations (
      article_id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`,
  );
}

/**
 * DBインスタンスを取得する（未初期化の場合は初期化する）
 *
 * @returns SQLiteDatabase インスタンス
 */
async function getDb(): Promise<SQLiteDatabase> {
  if (db === null) {
    await initLocalDb();
  }
  return db as SQLiteDatabase;
}

/**
 * オフライン用の記事一覧を取得する
 *
 * @returns ローカルDBに保存された記事一覧
 */
export async function getOfflineArticles(): Promise<ArticleListItem[]> {
  const database = await getDb();

  const rows = await database.getAllAsync<ArticleRow>(
    "SELECT id, title, author, source, published_at, excerpt, thumbnail_url, url, is_favorite FROM articles ORDER BY synced_at DESC",
  );

  return rows.map(rowToArticleListItem);
}

/**
 * 指定IDのオフライン記事詳細を取得する
 *
 * @param id - 記事ID
 * @returns 記事詳細。存在しない場合はnull
 */
export async function getOfflineArticleById(id: string): Promise<ArticleDetail | null> {
  const database = await getDb();

  const row = await database.getFirstAsync<ArticleRow>(
    `SELECT a.*, s.content AS summary, t.content AS translation
     FROM articles a
     LEFT JOIN summaries s ON s.article_id = a.id
     LEFT JOIN translations t ON t.article_id = a.id
     WHERE a.id = ?`,
    [id],
  );

  if (row === null) {
    return null;
  }

  return rowToArticleDetail(row);
}

/**
 * 記事をローカルDBに保存する（存在する場合は上書き）
 *
 * @param article - 保存する記事（ArticleListItem または ArticleDetail）
 */
export async function upsertArticle(article: ArticleListItem | ArticleDetail): Promise<void> {
  const database = await getDb();

  const detail = article as ArticleDetail;

  await database.runAsync(
    `INSERT OR REPLACE INTO articles
      (id, title, author, source, published_at, excerpt, thumbnail_url, url,
       is_favorite, content, is_read, reading_time_minutes, created_at, updated_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      article.id,
      article.title,
      article.author ?? null,
      article.source,
      article.publishedAt ?? null,
      article.excerpt ?? null,
      article.thumbnailUrl ?? null,
      article.url,
      article.isFavorite ? 1 : 0,
      detail.content ?? null,
      detail.isRead ? 1 : 0,
      detail.readingTimeMinutes ?? null,
      detail.createdAt ?? null,
      detail.updatedAt ?? null,
    ],
  );
}

/**
 * 記事の要約をローカルDBに保存する（存在する場合は上書き）
 *
 * @param articleId - 記事ID
 * @param summary - 要約テキスト
 */
export async function upsertSummary(articleId: string, summary: string): Promise<void> {
  const database = await getDb();

  await database.runAsync(
    `INSERT OR REPLACE INTO summaries (article_id, content, synced_at)
     VALUES (?, ?, datetime('now'))`,
    [articleId, summary],
  );
}

/**
 * 記事の翻訳をローカルDBに保存する（存在する場合は上書き）
 *
 * @param articleId - 記事ID
 * @param translation - 翻訳テキスト
 */
export async function upsertTranslation(articleId: string, translation: string): Promise<void> {
  const database = await getDb();

  await database.runAsync(
    `INSERT OR REPLACE INTO translations (article_id, content, synced_at)
     VALUES (?, ?, datetime('now'))`,
    [articleId, translation],
  );
}

/**
 * 本文をオフライン保存すべき記事 ID を取得する
 * - synced_at DESC の先頭 limit 件
 * - + is_favorite = 1 の全記事（重複除外）
 *
 * @param limit - 最新記事の取得件数
 * @returns 対象記事 ID の配列（重複なし）
 */
export async function getOfflineTargetArticleIds(limit: number): Promise<string[]> {
  const database = await getDb();

  const rows = await database.getAllAsync<{ id: string }>(
    `SELECT id FROM articles
     WHERE id IN (SELECT id FROM articles ORDER BY synced_at DESC LIMIT ?)
     OR is_favorite = 1`,
    [limit],
  );

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of rows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      ids.push(row.id);
    }
  }
  return ids;
}

/**
 * 全オフラインデータを削除する
 * 外部キー制約の順序に従い translations → summaries → articles の順で削除する
 */
export async function clearAllOfflineData(): Promise<void> {
  const database = await getDb();

  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM translations", []);
    await database.runAsync("DELETE FROM summaries", []);
    await database.runAsync("DELETE FROM articles", []);
  });
}

/**
 * DBの行データを ArticleListItem 型に変換する
 */
function rowToArticleListItem(row: ArticleRow): ArticleListItem {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    source: row.source as ArticleListItem["source"],
    publishedAt: row.published_at,
    excerpt: row.excerpt,
    thumbnailUrl: row.thumbnail_url,
    url: row.url,
    isFavorite: row.is_favorite === 1,
  };
}

/**
 * DBの行データを ArticleDetail 型に変換する
 */
function rowToArticleDetail(row: ArticleRow): ArticleDetail {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    source: row.source as ArticleDetail["source"],
    publishedAt: row.published_at,
    content: row.content ?? null,
    excerpt: row.excerpt,
    thumbnailUrl: row.thumbnail_url,
    url: row.url,
    isFavorite: row.is_favorite === 1,
    isRead: (row.is_read ?? 0) === 1,
    summary: row.summary ?? null,
    translation: row.translation ?? null,
    readingTimeMinutes: row.reading_time_minutes ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}
