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
  tags?: Record<string, string>;
  exception: {
    values: Array<{
      type: string;
      value: string;
    }>;
  };
};

/**
 * Sentry DSN を解析して各部分を返す
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

function buildSentryUrl(parts: SentryDsnParts): string {
  return `https://${parts.host}/api/${parts.projectId}/store/`;
}

function buildAuthHeader(publicKey: string): string {
  return `Sentry sentry_version=7, sentry_client=tech-clip-workers/1.0, sentry_key=${publicKey}`;
}

function buildSentryEvent(
  error: Error,
  environment?: string,
  tags?: Record<string, string>,
): SentryEvent {
  return {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    ...(environment !== undefined ? { environment } : {}),
    ...(tags !== undefined && Object.keys(tags).length > 0 ? { tags } : {}),
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

async function captureError(
  dsn: string,
  error: Error,
  fetchFn: typeof fetch,
  environment?: string,
  tags?: Record<string, string>,
): Promise<void> {
  const parts = parseDsn(dsn);
  if (!parts) {
    return;
  }

  const url = buildSentryUrl(parts);
  const event = buildSentryEvent(error, environment, tags);

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
