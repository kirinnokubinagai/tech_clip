/**
 * パーサーが抽出した記事データの型定義
 */
export type ParsedArticle = {
  /** 記事タイトル */
  title: string;
  /** 著者名 */
  author: string | null;
  /** Markdown変換済み本文 */
  content: string;
  /** 記事の概要 */
  excerpt: string | null;
  /** サムネイル画像URL */
  thumbnailUrl: string | null;
  /** 推定読了時間（分） */
  readingTimeMinutes: number;
  /** 公開日（ISO 8601形式） */
  publishedAt: string | null;
  /** 記事ソース識別子 */
  source: string;
};
