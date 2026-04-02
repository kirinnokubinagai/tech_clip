/** ログレベル */
type LogLevel = "info" | "warn" | "error" | "debug";

/** ロガーの型 */
export type Logger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
};

/** ログレベルに対応するconsoleメソッドのマッピング */
const CONSOLE_METHODS: Record<LogLevel, (message: string, ...args: unknown[]) => void> = {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

/**
 * ログレベルに対応するconsoleメソッドを返す
 *
 * @param level - ログレベル
 * @returns consoleメソッド
 */
function getConsoleMethod(level: LogLevel): (message: string, ...args: unknown[]) => void {
  return CONSOLE_METHODS[level];
}

/**
 * ログを出力する
 *
 * 本番環境（__DEV__ が false）では debug レベルのログを抑制する。
 *
 * @param level - ログレベル
 * @param message - ログメッセージ
 * @param context - 追加コンテキスト
 */
function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (level === "debug" && !__DEV__) {
    return;
  }
  const method = getConsoleMethod(level);
  if (context !== undefined) {
    method(`[${level.toUpperCase()}] ${message}`, context);
    return;
  }
  method(`[${level.toUpperCase()}] ${message}`);
}

/**
 * React Native向けロガーを生成する
 *
 * 開発環境・本番環境ともにログを出力する。
 * レベルに応じたconsoleメソッド（info/warn/error/debug）を使用する。
 *
 * @returns ロガーインスタンス
 */
export function createLogger(): Logger {
  return {
    info: (message, context) => writeLog("info", message, context),
    warn: (message, context) => writeLog("warn", message, context),
    error: (message, context) => writeLog("error", message, context),
    debug: (message, context) => writeLog("debug", message, context),
  };
}

/** モジュールレベルのデフォルトロガーインスタンス */
export const logger = createLogger();
