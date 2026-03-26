import { cors } from "hono/cors";

/** Expo カスタムスキーム */
const EXPO_CUSTOM_SCHEME = "techclip://";

/** Expo Go / 開発用ローカルオリジン */
const LOCAL_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
];

/** 許可するオリジン一覧（固定） */
const ALLOWED_ORIGINS = [EXPO_CUSTOM_SCHEME, ...LOCAL_ORIGINS];

/** 本番サブドメインのサフィックス */
const PRODUCTION_DOMAIN_SUFFIX = ".techclip.app";

/** プリフライトキャッシュ有効期限（秒） */
const PREFLIGHT_MAX_AGE_SECONDS = 86400;

/**
 * オリジンが許可対象か判定する
 *
 * @param origin - リクエストのOriginヘッダー値
 * @returns 許可する場合はそのオリジン文字列、拒否する場合は空文字
 */
function resolveOrigin(origin: string): string {
  if (!origin) {
    return "*";
  }
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  if (origin.endsWith(PRODUCTION_DOMAIN_SUFFIX)) {
    return origin;
  }
  return "";
}

/**
 * CORS ミドルウェア
 *
 * Hono組み込みのcors()を使用し、許可オリジン・メソッド・ヘッダーを設定する。
 * Expo（カスタムスキーム・localhost）と本番サブドメインを許可する。
 */
export const corsMiddleware = cors({
  origin: resolveOrigin,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: PREFLIGHT_MAX_AGE_SECONDS,
});
