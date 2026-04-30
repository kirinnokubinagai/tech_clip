/**
 * Drizzle ORMのクエリ結果を汎用レコードにキャストする
 *
 * Drizzle の select() / leftJoin() が返す型は複雑なユニオン型になるため、
 * APIレスポンスとして返す際に汎用型へのキャストが必要。
 *
 * @remarks
 * このモジュールは暫定的なキャスト層である。
 * Drizzle ORM の型推論が改善された時点で toRecord / toRecordArray ごと廃止する。
 * 廃止作業は Issue #1056 の follow-up として別 Issue で実施する。
 */

/**
 * 単一レコードを汎用レコードにキャストする
 *
 * @param result - Drizzle のクエリ結果（単一レコード）
 * @returns 汎用レコード
 */
export function toRecord<T extends Record<string, unknown>>(result: Record<string, unknown>): T {
  return result as T;
}

/**
 * レコード配列を汎用レコード配列にキャストする
 *
 * Drizzle 型推論改善後にこの関数ごと廃止予定（Issue #1056 follow-up）。
 *
 * @param results - Drizzle のクエリ結果（配列）
 * @returns 汎用レコード配列
 */
export function toRecordArray(results: unknown[]): Array<Record<string, unknown>> {
  return results as Array<Record<string, unknown>>;
}
