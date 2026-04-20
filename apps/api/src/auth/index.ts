import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import type { Database } from "../db";
import * as schema from "../db/schema";
import { users } from "../db/schema";
import { type EmailEnv, sendEmailVerification } from "../services/emailService";

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

/** ローカル開発用のAPI URL（Better Auth baseURL のデフォルト） */
const DEFAULT_API_BASE_URL = "http://localhost:18787/api/auth";

/** モバイルアプリのカスタムスキーム */
const MOBILE_APP_SCHEME = "techclip://";

/** Better Auth インスタンスの型 */
export type Auth = ReturnType<typeof createAuth>;

/**
 * Better Auth インスタンスを生成する
 *
 * @param db - Drizzle ORM データベースインスタンス
 * @param secret - Better Auth 暗号化用シークレットキー
 * @param oauthProviders - OAuthプロバイダー設定（省略可）
 * @param baseURL - Better Auth のベースURL（API 自身の URL を渡す。省略時は DEFAULT_API_BASE_URL を使用）
 * @param additionalTrustedOrigins - 環境変数から追加するtrustedOrigins（省略可）
 * @param emailEnv - メール送信環境変数（省略可）
 * @returns Better Auth インスタンス
 */
export function createAuth(
  db: Database,
  secret: string,
  oauthProviders?: OAuthProviderConfig,
  baseURL?: string,
  additionalTrustedOrigins?: string[],
  emailEnv?: EmailEnv,
) {
  const trustedOrigins = [
    MOBILE_APP_SCHEME,
    LOCAL_APP_URL,
    PRODUCTION_APP_URL,
    PRODUCTION_API_URL,
    ...(additionalTrustedOrigins ?? []),
  ];

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      usePlural: true,
      experimental: { joins: true },
    } as Parameters<typeof drizzleAdapter>[1]),
    secret,
    baseURL: baseURL ?? DEFAULT_API_BASE_URL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: { email: string; name?: string };
        url: string;
      }) => {
        if (!emailEnv) {
          return;
        }
        await sendEmailVerification(emailEnv, user.email, user.name ?? "", url);
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!user.name || user.name.trim() === "") {
              const localPart = user.email.split("@")[0] ?? user.email;
              return {
                data: { ...user, name: localPart },
              };
            }
            return { data: user };
          },
          after: async (user) => {
            if (user.email.includes("+maestro@")) {
              await db
                .update(users)
                .set({ isTestAccount: true, emailVerified: true })
                .where(eq(users.id, user.id));
            }
          },
        },
      },
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
    trustedOrigins,
  });
}
