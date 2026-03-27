/** ログレベル */
type LogLevel = "info" | "warn" | "error" | "debug";

/** ログエントリの型 */
type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
};

/** ロガーの型 */
export type Logger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
  withRequestId: (requestId: string) => Logger;
};

/**
 * ログエントリをJSON文字列として出力する
 *
 * @param level - ログレベル
 * @param message - ログメッセージ
 * @param context - 追加コンテキスト
 * @param requestId - リクエストID（オプション）
 */
function writeLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  requestId?: string,
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(requestId !== undefined ? { requestId } : {}),
    ...(context ?? {}),
  };
  console.log(JSON.stringify(entry));
}

/**
 * 構造化ロガーを生成する
 *
 * Cloudflare Workers 環境向けに console.log で JSON 形式のログを出力する。
 *
 * @returns ロガーインスタンス
 */
export function createLogger(requestId?: string): Logger {
  return {
    info: (message, context) => writeLog("info", message, context, requestId),
    warn: (message, context) => writeLog("warn", message, context, requestId),
    error: (message, context) => writeLog("error", message, context, requestId),
    debug: (message, context) => writeLog("debug", message, context, requestId),
    withRequestId: (id) => createLogger(id),
  };
}
