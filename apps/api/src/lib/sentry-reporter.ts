import { captureError } from "../middleware/sentry";

/**
 * Sentry に Error イベントを送る fire-and-forget ヘルパー
 *
 * SENTRY_DSN が無い / development / test 環境では何もしない。
 * Sentry 送信自体が失敗しても呼び出し元には例外を返さない。
 *
 * @param env - Cloudflare Workers env (SENTRY_DSN / ENVIRONMENT を読む)
 * @param error - 送信するエラー
 * @param tags - イベントに付与するタグ（user_id 等）
 * @param fetchFn - fetch 実装（テスト時にモック差し替え可能）
 */
export async function notifyError(
  env: { SENTRY_DSN?: string; ENVIRONMENT?: string },
  error: Error,
  tags: Record<string, string>,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const dsn = env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  const environment = env.ENVIRONMENT;
  if (environment !== "production" && environment !== "staging") {
    return;
  }
  try {
    await captureError(dsn, error, fetchFn, environment, tags);
  } catch {
    // fire-and-forget: 送信失敗は呼び出し元に伝えない
  }
}
