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

/**
 * Better Auth インスタンスを生成する
 *
 * @param db - Drizzle ORM データベースインスタンス
 * @param secret - Better Auth 暗号化用シークレットキー
 * @param oauthProviders - OAuthプロバイダー設定（省略可）
 * @returns Better Auth インスタンス
 */
export function createAuth(db: Database, secret: string, oauthProviders?: OAuthProviderConfig) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret,
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
    trustedOrigins: ["techclip://", "http://localhost:8081"],
  });
}
