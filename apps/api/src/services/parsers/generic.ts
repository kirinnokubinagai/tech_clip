import type { ParsedArticleContent } from "../article-parser";

/**
 * 汎用HTMLパーサー（スタブ）
 *
 * #43 で本実装される。現時点ではプレースホルダーとして未実装エラーを投げる。
 *
 * @param _url - パース対象のURL
 * @returns パースされた記事コンテンツ
 * @throws Error - 未実装のため常にエラー
 */
export async function parseGeneric(_url: string): Promise<ParsedArticleContent> {
  throw new Error("汎用パーサーは未実装です（#43で実装予定）");
}
