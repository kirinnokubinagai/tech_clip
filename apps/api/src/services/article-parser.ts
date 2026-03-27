import type { ArticleSource } from "@tech-clip/types";

import { detectSource } from "./source-detector";

/**
 * パーサーが返す記事コンテンツ（sourceを除く）
 *
 * 個別パーサー・汎用パーサーはこの型を返す。
 * sourceフィールドはarticle-parserが付与する。
 */
export type ParsedArticleContent = {
  title: string;
  content: string | null;
  excerpt: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  readingTimeMinutes: number | null;
};

/**
 * パース済み記事（source付き）
 */
export type ParsedArticle = ParsedArticleContent & {
  source: ArticleSource;
};

/**
 * URLから記事をパースする
 *
 * sourceDetectorでソースを判定し、対応するパーサーを呼び出す。
 * 個別パーサーが未実装のソースは汎用パーサーにフォールバックする。
 *
 * @param url - パース対象のURL文字列
 * @returns パース済み記事データ
 */
export async function parseArticle(url: string): Promise<ParsedArticle> {
  const source = detectSource(url);

  const { parseGeneric } = await import("./parsers/generic");
  const result = await parseGeneric(url);

  return { ...result, source };
}
