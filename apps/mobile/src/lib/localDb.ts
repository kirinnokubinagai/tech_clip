import type { SQLiteDatabase } from "expo-sqlite";
import { openDatabaseAsync } from "expo-sqlite";

import type { SummaryLang } from "@/lib/language-code";
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
  user_id?: string | null;
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

type TableInfoRow = {
  name: string;
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
      user_id TEXT,
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
      article_id TEXT NOT NULL,
      language TEXT NOT NULL,
      content TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (article_id, language),
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`,
  );

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS translations (
      article_id TEXT NOT NULL,
      target_language TEXT NOT NULL,
      content TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (article_id, target_language),
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`,
  );

  await migrateLegacyAiCacheTables(db);
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

async function hasColumn(
  database: SQLiteDatabase,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = await database.getAllAsync<TableInfoRow>(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

async function migrateLegacyAiCacheTables(database: SQLiteDatabase): Promise<void> {
  const articlesHaveUserId = await hasColumn(database, "articles", "user_id");
  if (!articlesHaveUserId) {
    await database.execAsync("ALTER TABLE articles ADD COLUMN user_id TEXT");
  }

  const summariesHaveLanguage = await hasColumn(database, "summaries", "language");
  if (!summariesHaveLanguage) {
    await database.execAsync(
      `CREATE TABLE IF NOT EXISTS summaries_v2 (
        article_id TEXT NOT NULL,
        language TEXT NOT NULL,
        content TEXT NOT NULL,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (article_id, language),
        FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
      );
      INSERT INTO summaries_v2 (article_id, language, content, synced_at)
      SELECT article_id, 'ja', content, COALESCE(synced_at, datetime('now')) FROM summaries;
      DROP TABLE summaries;
      ALTER TABLE summaries_v2 RENAME TO summaries;`,
    );
  }

  const translationsHaveTargetLanguage = await hasColumn(
    database,
    "translations",
    "target_language",
  );
  if (!translationsHaveTargetLanguage) {
    await database.execAsync(
      `CREATE TABLE IF NOT EXISTS translations_v2 (
        article_id TEXT NOT NULL,
        target_language TEXT NOT NULL,
        content TEXT NOT NULL,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (article_id, target_language),
        FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
      );
      INSERT INTO translations_v2 (article_id, target_language, content, synced_at)
      SELECT article_id, 'en', content, COALESCE(synced_at, datetime('now')) FROM translations;
      DROP TABLE translations;
      ALTER TABLE translations_v2 RENAME TO translations;`,
    );
  }
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
 * @param language - 要約言語
 * @param targetLanguage - 翻訳言語
 * @returns 記事詳細。存在しない場合はnull
 */
export async function getOfflineArticleById(
  id: string,
  language: SummaryLang = "ja",
  targetLanguage: SummaryLang = "en",
): Promise<ArticleDetail | null> {
  const database = await getDb();

  const row = await database.getFirstAsync<ArticleRow>(
    `SELECT a.*, s.content AS summary, t.content AS translation
     FROM articles a
     LEFT JOIN summaries s ON s.article_id = a.id AND s.language = ?
     LEFT JOIN translations t ON t.article_id = a.id AND t.target_language = ?
     WHERE a.id = ?`,
    [language, targetLanguage, id],
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
      (id, user_id, title, author, source, published_at, excerpt, thumbnail_url, url,
       is_favorite, content, is_read, reading_time_minutes, created_at, updated_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      article.id,
      detail.userId ?? null,
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
 * @param language - 要約言語
 * @param summary - 要約テキスト
 */
export async function upsertSummary(
  articleId: string,
  language: SummaryLang,
  summary: string,
): Promise<void> {
  const database = await getDb();

  await database.runAsync(
    `INSERT OR REPLACE INTO summaries (article_id, language, content, synced_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [articleId, language, summary],
  );
}

/**
 * 記事の翻訳をローカルDBに保存する（存在する場合は上書き）
 *
 * @param articleId - 記事ID
 * @param targetLanguage - 翻訳言語
 * @param translation - 翻訳テキスト
 */
export async function upsertTranslation(
  articleId: string,
  targetLanguage: SummaryLang,
  translation: string,
): Promise<void> {
  const database = await getDb();

  await database.runAsync(
    `INSERT OR REPLACE INTO translations (article_id, target_language, content, synced_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [articleId, targetLanguage, translation],
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
    userId: row.user_id ?? "",
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
