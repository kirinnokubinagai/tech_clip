import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

/** Expo カスタムスキーム */
const EXPO_CUSTOM_SCHEME = "techclip://";

/** Expo Go / 開発用ローカルオリジン */
const LOCAL_ORIGINS = ["http://localhost:8081", "http://localhost:19006"];

/** プリフライトキャッシュ有効期限（秒） */
const PREFLIGHT_MAX_AGE_SECONDS = 86400;

/**
 * 環境変数 CORS_ALLOWED_ORIGINS からオリジンリストを取得する
 *
 * @returns カンマ区切りで指定された追加許可オリジンの配列。未設定時は空配列
 */
function getEnvAllowedOrigins(): string[] {
  const envValue = process.env.CORS_ALLOWED_ORIGINS;
  if (!envValue) {
    return [];
  }
  return envValue
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * デフォルトの許可オリジン一覧
 *
 * フォールバック値として固定オリジンを保持する。
 * 本番サブドメインは環境変数 CORS_ALLOWED_ORIGINS で追加する。
 */
const DEFAULT_ALLOWED_ORIGINS: string[] = [
  EXPO_CUSTOM_SCHEME,
  ...LOCAL_ORIGINS,
  ...getEnvAllowedOrigins(),
];

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
 * @param allowedOrigins - 許可するオリジンの配列（完全一致ホワイトリスト）
 * @returns Hono ミドルウェアハンドラー
 */
export function createCorsMiddleware(allowedOrigins: string[]): MiddlewareHandler {
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
 * 追加オリジンは環境変数 CORS_ALLOWED_ORIGINS にカンマ区切りで設定する。
 */
export const corsMiddleware: MiddlewareHandler = createCorsMiddleware(DEFAULT_ALLOWED_ORIGINS);
