/**
 * Drizzle ORMのクエリ結果を汎用レコード配列にキャストする
 *
 * Drizzle の select() / leftJoin() が返す型は複雑なユニオン型になるため、
 * APIレスポンスとして返す際に汎用型へのキャストが必要。
 * 将来的に Drizzle の型推論が改善された場合はこのヘルパーを廃止する。
 *
 * @param results - Drizzle のクエリ結果
 * @returns 汎用レコード配列
 */
export function toRecordArray(results: unknown): Array<Record<string, unknown>> {
  return results as Array<Record<string, unknown>>;
}
