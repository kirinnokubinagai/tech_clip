import * as Sentry from "@sentry/react-native";

/** ログレベル */
type LogLevel = "info" | "warn" | "error" | "debug";

/** ロガーの型 */
export type Logger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
};

<<<<<<< HEAD
/**
 * ログレベルに対応する console メソッドを返す
 *
 * 呼び出し時に console から参照を取得することで、
 * jest.spyOn によるモック差し替えが正しく機能する。
 *
 * @param level - ログレベル
 * @returns consoleメソッド
 */
function getConsoleMethod(level: LogLevel): (message: string, ...args: unknown[]) => void {
  if (level === "info") return console.info;
  if (level === "warn") return console.warn;
  if (level === "error") return console.error;
  return console.debug;
}

/**
 * context から Error オブジェクトを抽出する
 *
 * context に `error` キーが存在し、その値が Error インスタンスの場合のみ返す。
 *
 * @param context - ログコンテキスト
 * @returns Error オブジェクト。存在しない場合は null
 */
function extractError(context: Record<string, unknown> | undefined): Error | null {
  if (!context) {
    return null;
  }
  const maybeError = context.error;
  if (maybeError instanceof Error) {
    return maybeError;
  }
  return null;
}

=======
>>>>>>> origin/main
/**
 * ログを出力する
 *
 * 本番環境（__DEV__ が false）では debug と info レベルのログを抑制する。
 * error レベルかつ Sentry が初期化済みの場合、context.error を Sentry に送信する。
 *
 * @param level - ログレベル
 * @param message - ログメッセージ
 * @param context - 追加コンテキスト
 */
function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!__DEV__ && (level === "debug" || level === "info")) {
    return;
  }
<<<<<<< HEAD
  const method = getConsoleMethod(level);
  if (context !== undefined) {
    method(`[${level.toUpperCase()}] ${message}`, context);
  } else {
    method(`[${level.toUpperCase()}] ${message}`);
  }

  if (level !== "error") {
    return;
  }
  if (!Sentry.isInitialized()) {
    return;
  }
  const error = extractError(context);
  if (!error) {
    return;
  }
  Sentry.captureException(error);
=======
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
>>>>>>> origin/main
}

/**
 * React Native向けロガーを生成する
 *
 * 開発環境・本番環境ともにログを出力する。
 * レベルに応じたconsoleメソッド（info/warn/error/debug）を使用する。
 * error レベルでは Sentry にも例外を送信する（Sentry 初期化済みの場合のみ）。
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
