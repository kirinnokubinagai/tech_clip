import type { Context, MiddlewareHandler } from "hono";

/** HTTP 429 Too Many Requests ステータスコード */
const HTTP_TOO_MANY_REQUESTS = 429;

/** レート制限超過エラーコード */
const RATE_LIMIT_ERROR_CODE = "RATE_LIMIT_EXCEEDED";

/** レート制限超過エラーメッセージ */
const RATE_LIMIT_ERROR_MESSAGE = "リクエストが多すぎます。しばらく待ってから再度お試しください";

/**
 * レート制限ストアのエントリー
 */
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/**
 * レート制限ストアのインターフェース
 *
 * ローカル開発はインメモリMap、本番はCloudflare Workers KVを注入可能
 */
export type RateLimitStore = {
  get: (key: string) => Promise<RateLimitEntry | null> | RateLimitEntry | null;
  set: (key: string, value: RateLimitEntry) => Promise<void> | void;
  clear: () => Promise<void> | void;
};

/**
 * レート制限ミドルウェアの設定
 */
export type RateLimitConfig = {
  /** ウィンドウ内の最大リクエスト数 */
  limit: number;
  /** ウィンドウの長さ（ミリ秒） */
  windowMs: number;
  /** ストアキーのプレフィックス */
  keyPrefix: string;
  /** ユーザーIDを取得する関数（未指定時はIPベース） */
  getUserId?: (c: Context) => string | null;
};

/**
 * 定義済みレート制限設定
 *
 * 各ルートカテゴリに対応した制限値を定義する
 */
export const RATE_LIMIT_CONFIG = {
  /** 認証関連: 10リクエスト/分 */
  auth: {
    limit: 10,
    windowMs: 60_000,
    keyPrefix: "auth",
  },
  /** 記事保存: 30リクエスト/分 */
  articleSave: {
    limit: 30,
    windowMs: 60_000,
    keyPrefix: "article_save",
  },
  /** AI関連（要約・翻訳）: 10リクエスト/分 */
  ai: {
    limit: 10,
    windowMs: 60_000,
    keyPrefix: "ai",
  },
  /** 一般API: 100リクエスト/分 */
  general: {
    limit: 100,
    windowMs: 60_000,
    keyPrefix: "general",
  },
} as const satisfies Record<string, RateLimitConfig>;

/**
 * デフォルトのインメモリレート制限ストアを生成する
 *
 * @returns インメモリMapを使ったRateLimitStore
 */
export function createInMemoryStore(): RateLimitStore {
  const store = new Map<string, RateLimitEntry>();
  return {
    get: (key: string) => store.get(key) ?? null,
    set: (key: string, value: RateLimitEntry) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
  };
}

/** KV エントリのTTL（秒）：最大ウィンドウ長より長く保持する */
const KV_TTL_SECONDS = 120;

/**
 * Cloudflare Workers KV を使ったレート制限ストアを生成する
 *
 * @param kv - Workers KV namespace バインディング
 * @returns KVNamespace を使ったRateLimitStore
 */
export function createKvStore(kv: KVNamespace): RateLimitStore {
  return {
    get: async (key: string) => {
      const raw = await kv.get(key, "json");
      if (raw === null) {
        return null;
      }
      return raw as RateLimitEntry;
    },
    set: async (key: string, value: RateLimitEntry) => {
      await kv.put(key, JSON.stringify(value), { expirationTtl: KV_TTL_SECONDS });
    },
    clear: async () => {
      // KV には一括削除APIがないため、このメソッドはno-op
    },
  };
}

/** デフォルトのインメモリストア（開発環境用） */
const defaultStore = createInMemoryStore();

/**
 * リクエストのIPアドレスを取得する
 *
 * Cloudflare Workers環境ではCF-Connecting-IPを優先する
 *
 * @param c - Honoコンテキスト
 * @returns IPアドレス文字列
 */
function getClientIp(c: Context): string {
  const cfIp = c.req.header("CF-Connecting-IP");
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = c.req.header("X-Forwarded-For");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return "unknown";
}

/**
 * レート制限ミドルウェアを生成する
 *
 * IPベースまたはユーザーIDベースでリクエスト数をカウントし、
 * 制限を超えた場合は429を返す。Retry-Afterヘッダーも付与する。
 *
 * @param config - レート制限設定
 * @param store - レート制限ストア（省略時はデフォルトのインメモリストア）
 * @returns Hono ミドルウェアハンドラー
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig,
  store: RateLimitStore = defaultStore,
): MiddlewareHandler {
  return async (c, next) => {
    const identifier = config.getUserId ? (config.getUserId(c) ?? getClientIp(c)) : getClientIp(c);
    const key = `${config.keyPrefix}:${identifier}`;
    const now = Date.now();

    let existing: RateLimitEntry | null;
    try {
      existing = await store.get(key);
    } catch {
      await next();
      return;
    }

    if (!existing || existing.resetAt <= now) {
      try {
        await store.set(key, { count: 1, resetAt: now + config.windowMs });
      } catch {
        // フェイルオープン: 書き込み失敗時もリクエストを通す
      }
      await next();
      return;
    }

    if (existing.count >= config.limit) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);

      c.header("Retry-After", String(retryAfterSeconds));

      return c.json(
        {
          success: false,
          error: {
            code: RATE_LIMIT_ERROR_CODE,
            message: RATE_LIMIT_ERROR_MESSAGE,
          },
        },
        HTTP_TOO_MANY_REQUESTS,
      );
    }

    try {
      await store.set(key, { count: existing.count + 1, resetAt: existing.resetAt });
    } catch {
      // フェイルオープン: 書き込み失敗時もリクエストを通す
    }
    await next();
  };
}
