import type { MiddlewareHandler } from "hono";

/** Sentry DSN の解析結果 */
type SentryDsnParts = {
  publicKey: string;
  host: string;
  projectId: string;
};

/** Sentry イベントのペイロード型 */
type SentryEvent = {
  event_id: string;
  timestamp: string;
  platform: string;
  environment?: string;
  exception: {
    values: Array<{
      type: string;
      value: string;
    }>;
  };
};

/** Sentry ミドルウェアの Bindings 型（SENTRY_DSN を含む環境） */
type SentryBindings = {
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  [key: string]: unknown;
};

/**
 * Sentry DSN を解析して各部分を返す
 *
 * @param dsn - Sentry DSN 文字列（例: https://key@host/projectId）
 * @returns 解析結果。不正な場合は null
 */
function parseDsn(dsn: string): SentryDsnParts | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const projectId = url.pathname.replace("/", "");
    if (!publicKey || !host || !projectId) {
      return null;
    }
    return { publicKey, host, projectId };
  } catch {
    return null;
  }
}

/**
 * Sentry エンドポイント URL を構築する
 *
 * @param parts - 解析済み DSN 情報
 * @returns Sentry store エンドポイント URL
 */
function buildSentryUrl(parts: SentryDsnParts): string {
  return `https://${parts.host}/api/${parts.projectId}/store/`;
}

/**
 * Sentry 認証ヘッダー文字列を構築する
 *
 * @param publicKey - Sentry public key
 * @returns X-Sentry-Auth ヘッダー値
 */
function buildAuthHeader(publicKey: string): string {
  return `Sentry sentry_version=7, sentry_client=tech-clip-workers/1.0, sentry_key=${publicKey}`;
}

/**
 * エラーから Sentry イベントペイロードを生成する
 *
 * @param error - キャプチャするエラー
 * @param environment - デプロイ環境識別子（省略可）
 * @returns Sentry イベントオブジェクト
 */
function buildSentryEvent(error: Error, environment?: string): SentryEvent {
  return {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    ...(environment !== undefined ? { environment } : {}),
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
        },
      ],
    },
  };
}

/**
 * Sentry にエラーイベントを送信する
 *
 * @param dsn - Sentry DSN 文字列
 * @param error - 送信するエラー
 * @param fetchFn - fetch 実装（テスト時にモック差し替え可能）
 * @param environment - デプロイ環境識別子（省略可）
 */
export async function captureError(
  dsn: string,
  error: Error,
  fetchFn: typeof fetch,
  environment?: string,
): Promise<void> {
  const parts = parseDsn(dsn);
  if (!parts) {
    return;
  }

  const url = buildSentryUrl(parts);
  const event = buildSentryEvent(error, environment);

  await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": buildAuthHeader(parts.publicKey),
    },
    body: JSON.stringify(event),
  });
}

/**
 * Sentry エラー監視ミドルウェアを生成する
 *
 * 未処理の例外を Sentry に送信する。
 * 環境変数 SENTRY_DSN が未設定の場合はエラーをキャプチャしない。
 * production / staging 以外の環境では SENTRY_DSN があってもスキップする。
 *
 * @param fetchFn - fetch 実装（デフォルトはグローバル fetch）
 * @returns Hono ミドルウェアハンドラー
 */
export function createSentryMiddleware(
  fetchFn: typeof fetch = fetch,
): MiddlewareHandler<{ Bindings: SentryBindings }> {
  return async (c, next) => {
    await next();
    const err = c.error;
    if (!err) {
      return;
    }
    const dsn = c.env?.SENTRY_DSN;
    if (!dsn) {
      return;
    }
    // Sentry への送信は production / staging のみ許可する。
    // development / test では DSN があってもスキップし、本番シグナルのノイズを防ぐ。
    const environment = c.env?.ENVIRONMENT;
    if (environment !== "production" && environment !== "staging") {
      return;
    }
    if (err instanceof Error) {
      await captureError(dsn, err, fetchFn, environment);
    }
  };
}
