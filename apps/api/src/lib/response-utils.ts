/**
 * レスポンスユーティリティ
 * APIレスポンス整形に共通して使用するヘルパー関数群
 */

/**
 * レスポンスからcontentフィールドを除外する
 *
 * @param article - 記事データ
 * @returns contentを除いた記事データ
 */
export function omitContent(article: Record<string, unknown>): Record<string, unknown> {
  const { content: _, ...rest } = article;
  return rest;
}
