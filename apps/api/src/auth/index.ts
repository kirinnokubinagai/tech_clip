import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db";

/** OAuthプロバイダーの認証情報 */
type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

/** ソーシャルログインプロバイダー設定 */
export type OAuthProviderConfig = {
  google?: OAuthCredentials;
  apple?: OAuthCredentials;
  github?: OAuthCredentials;
};

/** 本番環境のアプリURL */
const PRODUCTION_APP_URL = "https://techclip.app";

/** 本番環境のAPI URL */
const PRODUCTION_API_URL = "https://api.techclip.app";

/** ローカル開発用のアプリURL */
const LOCAL_APP_URL = "http://localhost:8081";

/** モバイルアプリのカスタムスキーム */
const MOBILE_APP_SCHEME = "techclip://";

/**
 * Better Auth インスタンスを生成する
 *
 * @param db - Drizzle ORM データベースインスタンス
 * @param secret - Better Auth 暗号化用シークレットキー
 * @param oauthProviders - OAuthプロバイダー設定（省略可）
 * @param baseURL - Better Auth のベースURL（省略時はLOCAL_APP_URLを使用）
 * @returns Better Auth インスタンス
 */
export function createAuth(
  db: Database,
  secret: string,
  oauthProviders?: OAuthProviderConfig,
  baseURL?: string,
) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret,
    baseURL: baseURL ?? LOCAL_APP_URL,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      ...(oauthProviders?.google && {
        google: {
          clientId: oauthProviders.google.clientId,
          clientSecret: oauthProviders.google.clientSecret,
        },
      }),
      ...(oauthProviders?.apple && {
        apple: {
          clientId: oauthProviders.apple.clientId,
          clientSecret: oauthProviders.apple.clientSecret,
        },
      }),
      ...(oauthProviders?.github && {
        github: {
          clientId: oauthProviders.github.clientId,
          clientSecret: oauthProviders.github.clientSecret,
        },
      }),
    },
    trustedOrigins: [MOBILE_APP_SCHEME, LOCAL_APP_URL, PRODUCTION_APP_URL, PRODUCTION_API_URL],
  });
}
