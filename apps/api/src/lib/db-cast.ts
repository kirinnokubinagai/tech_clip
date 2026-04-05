/**
 * Drizzle ORMのクエリ結果を汎用レコードにキャストする
 *
 * Drizzle の select() / leftJoin() が返す型は複雑なユニオン型になるため、
 * APIレスポンスとして返す際に汎用型へのキャストが必要。
 * TODO: Drizzle型推論改善後にtoRecordArrayごと廃止する
 */

/**
 * 単一レコードを汎用レコードにキャストする
 *
 * @param result - Drizzle のクエリ結果（単一レコード）
 * @returns 汎用レコード
 */
export function toRecord<T extends Record<string, unknown>>(result: unknown): T {
  return result as T;
}

/**
 * レコード配列を汎用レコード配列にキャストする
 * TODO: Drizzle型推論改善後にtoRecordArrayごと廃止する
 *
 * @param results - Drizzle のクエリ結果（配列）
 * @returns 汎用レコード配列
 */
export function toRecordArray(results: unknown): Array<Record<string, unknown>> {
  return results as Array<Record<string, unknown>>;
}
