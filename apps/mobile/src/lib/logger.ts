/** ログレベル */
type LogLevel = "info" | "warn" | "error" | "debug";

/** ロガーの型 */
export type Logger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
};

/**
 * ログを出力する
 *
 * 本番環境（__DEV__ が false）では debug と info レベルのログを抑制する。
 *
 * @param level - ログレベル
 * @param message - ログメッセージ
 * @param context - 追加コンテキスト
 */
function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!__DEV__ && (level === "debug" || level === "info")) {
    return;
  }
  const formatted = `[${level.toUpperCase()}] ${message}`;
  switch (level) {
    case "info":
      context !== undefined ? console.info(formatted, context) : console.info(formatted);
      break;
    case "warn":
      context !== undefined ? console.warn(formatted, context) : console.warn(formatted);
      break;
    case "error":
      context !== undefined ? console.error(formatted, context) : console.error(formatted);
      break;
    case "debug":
      context !== undefined ? console.debug(formatted, context) : console.debug(formatted);
      break;
  }
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
