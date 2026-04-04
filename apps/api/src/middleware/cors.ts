import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

/** Expo カスタムスキーム */
const EXPO_CUSTOM_SCHEME = "techclip://";

/** Expo Go / 開発用ローカルオリジン */
const LOCAL_ORIGINS = ["http://localhost:8081", "http://localhost:19006"];

/** プリフライトキャッシュ有効期限（秒） */
const PREFLIGHT_MAX_AGE_SECONDS = 86400;

/** 本番環境の許可オリジン */
const PRODUCTION_ORIGINS = ["https://techclip.app", "https://api.techclip.app"];

/** デフォルトの許可オリジン一覧 */
const DEFAULT_ALLOWED_ORIGINS: string[] = [
  EXPO_CUSTOM_SCHEME,
  ...LOCAL_ORIGINS,
  ...PRODUCTION_ORIGINS,
];

/**
 * TRUSTED_ORIGINS の文字列をオリジン配列に変換する
 *
 * @param value - カンマ区切りのオリジン文字列
 * @returns 空文字を除去したオリジン配列
 */
function parseTrustedOrigins(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * オリジン判定関数を生成する
 *
 * @param allowedOrigins - 許可するオリジンの配列（完全一致）
 * @returns オリジン文字列を受け取り、許可する場合はそのオリジン文字列、拒否する場合は空文字を返す関数
 */
function buildOriginResolver(allowedOrigins: string[]): (origin: string) => string {
  return (origin: string): string => {
    if (!origin) {
      return "";
    }
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
    return "";
  };
}

/**
 * 指定オリジンリストで CORS ミドルウェアを生成する
 *
 * @param additionalOrigins - 環境変数等から取得した追加許可オリジンの配列
 * @returns Hono ミドルウェアハンドラー
 */
export function createCorsMiddleware(additionalOrigins: string[] = []): MiddlewareHandler {
  const allowedOrigins = [...DEFAULT_ALLOWED_ORIGINS, ...additionalOrigins];
  return cors({
    origin: buildOriginResolver(allowedOrigins),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  });
}

/**
 * CORS ミドルウェア
 *
 * Hono組み込みのcors()を使用し、許可オリジン・メソッド・ヘッダーを設定する。
 * サフィックスマッチングではなく完全一致ホワイトリスト方式を採用し、
 * 任意サブドメインからのアクセスを防ぐ。
 * 追加オリジンは各リクエストの `TRUSTED_ORIGINS` から読み込む。
 */
export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const additionalOrigins = parseTrustedOrigins(c.env?.TRUSTED_ORIGINS);
  const middleware = createCorsMiddleware(additionalOrigins);
  return middleware(c, next);
};
