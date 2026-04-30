import type { Auth } from "./auth";
import type { Database } from "./db";

/** Cloudflare Workers バインディング型定義 */
export type Bindings = {
  TURSO_DATABASE_URL: string;
  /** Cloudflare Workers AI バインディング */
  AI: Ai;
  TURSO_AUTH_TOKEN: string;
  ENVIRONMENT: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  /** レート制限用 Workers KV namespace */
  RATE_LIMIT: KVNamespace;
  /** キャッシュ用 Workers KV namespace */
  CACHE: KVNamespace;
  /** アバター画像保存用 R2 バケット */
  AVATARS_BUCKET: R2Bucket;
  /** アバター画像の公開 URL（末尾スラッシュなし） */
  R2_PUBLIC_URL: string;
  /** アプリのベースURL（パスワードリセット・OAuth deep link 用、必須） */
  APP_URL: string;
  /** API 自身のベース URL（Better Auth baseURL 用） */
  API_BASE_URL?: string;
  /** Mailpit API エンドポイント（ローカル開発用。設定時は Resend の代わりにメール送信） */
  MAILPIT_URL?: string;
  /** カンマ区切りの追加 trustedOrigins（例: "https://staging.example.com,https://dev.example.com"） */
  TRUSTED_ORIGINS?: string;
  /** Sentry DSN（エラー監視用） */
  SENTRY_DSN?: string;
  /** RevenueCat Webhook シークレット */
  REVENUECAT_WEBHOOK_SECRET?: string;
  /** GitHub Webhook HMAC-SHA256 シークレット */
  GITHUB_WEBHOOK_SECRET?: string;
  /** GitHub API アクセストークン（verdict 判定用） */
  GITHUB_TOKEN?: string;
  /** データベース保存用Gemmaモデルタグ（省略時は DEFAULT_GEMMA_MODEL_TAG を使用） */
  GEMMA_MODEL_NAME?: string;
  /** E2E テスト環境フラグ（"1" で有効。CI / ローカル dev のみ設定する） */
  IS_E2E_ENV?: string;
};

/** リクエストスコープで共有する変数 */
export type Variables = {
  db: Database;
  auth: () => Auth;
};

/** アプリ型ヘルパー */
export type AppEnv = { Bindings: Bindings; Variables: Variables };
