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
 * Error インスタンスを JSON シリアライズ可能なオブジェクトに変換する
 *
 * Error の name / message / stack は non-enumerable のため JSON.stringify では失われる。
 * この関数で明示的に取り出してシリアライズする。
 *
 * @param err - 変換する Error インスタンス
 * @returns シリアライズ可能なエラーオブジェクト
 */
function serializeError(err: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    serialized.cause = String(cause);
  }
  return serialized;
}

/**
 * ログエントリを JSON シリアライズする
 *
 * context 内の Error インスタンスを serializeError で変換してから stringify する。
 * Error の non-enumerable プロパティ（name / message / stack）を保持するため。
 *
 * @param entry - ログエントリ
 * @returns JSON 文字列
 */
function serializeEntry(entry: LogEntry): string {
  const out: Record<string, unknown> = { ...entry };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Error) {
      out[key] = serializeError(value);
    }
  }
  return JSON.stringify(out);
}

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
  console.log(serializeEntry(entry));
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
