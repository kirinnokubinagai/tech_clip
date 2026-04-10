/** テスト出力に表示しないログレベル */
export const SUPPRESSED_LOG_LEVELS = new Set(["info", "warn", "debug"]);

/**
 * ロガーが出力するJSON文字列かどうかを判定する
 *
 * @param log - console.log に渡された文字列
 * @returns ロガーのJSONログであれば true
 */
export function isLoggerJsonOutput(log: string): boolean {
  if (!log.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(log) as Record<string, unknown>;
    return typeof parsed.level === "string" && typeof parsed.message === "string";
  } catch {
    return false;
  }
}

/**
 * 抑制対象のログレベルかどうかを判定する
 *
 * @param log - console.log に渡された文字列
 * @returns 抑制対象であれば true
 */
export function isSuppressedLogLevel(log: string): boolean {
  try {
    const parsed = JSON.parse(log) as Record<string, unknown>;
    return typeof parsed.level === "string" && SUPPRESSED_LOG_LEVELS.has(parsed.level);
  } catch {
    return false;
  }
}

/**
 * テスト出力を抑制するかどうかを判定する
 *
 * info/warn/debug レベルのロガー出力はテスト時のノイズになるため抑制する。
 * error レベルは障害検知に重要なため常に表示する。
 *
 * @param log - console.log に渡された文字列
 * @returns 抑制する場合は false、表示する場合は undefined
 */
export function shouldSuppressTestLog(log: string): false | undefined {
  if (isLoggerJsonOutput(log) && isSuppressedLogLevel(log)) {
    return false;
  }
  return undefined;
}
