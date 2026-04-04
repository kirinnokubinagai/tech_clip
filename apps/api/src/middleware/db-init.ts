import type { MiddlewareHandler } from "hono";

import type { Auth, createAuth, OAuthProviderConfig } from "../auth";
import type { Database, DatabaseEnv } from "../db";

/** createDbInitMiddleware の依存関数型 */
type DbInitOptions = {
  createDatabaseFn: (env: DatabaseEnv) => Database;
  createAuthFn: typeof createAuth;
};

/** Bindings に必要な環境変数 */
type DbInitBindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  BETTER_AUTH_SECRET: string;
  APP_URL?: string;
  /** カンマ区切りの追加 trustedOrigins（例: "https://staging.example.com,https://dev.example.com"） */
  TRUSTED_ORIGINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

/** ミドルウェアがセットする Variables */
type DbInitVariables = {
  db: Database;
  auth: () => Auth;
};

/**
 * リクエストスコープで db と auth を初期化するミドルウェアを生成する
 *
 * @param options - createDatabase / createAuth のDI用オプション
 * @returns Hono ミドルウェア
 */
export function createDbInitMiddleware(
  options: DbInitOptions,
): MiddlewareHandler<{ Bindings: DbInitBindings; Variables: DbInitVariables }> {
  const { createDatabaseFn, createAuthFn } = options;

  return async (c, next) => {
    const db = createDatabaseFn({
      TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
    });

    c.set("db", db);

    let authInstance: Auth | null = null;

    c.set("auth", () => {
      if (authInstance) {
        return authInstance;
      }

      if (!c.env.BETTER_AUTH_SECRET) {
        throw new Error("環境変数 BETTER_AUTH_SECRET が設定されていません");
      }

      const oauthProviders: OAuthProviderConfig = {};

      if (c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET) {
        oauthProviders.google = {
          clientId: c.env.GOOGLE_CLIENT_ID,
          clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        };
      }
      if (c.env.APPLE_CLIENT_ID && c.env.APPLE_CLIENT_SECRET) {
        oauthProviders.apple = {
          clientId: c.env.APPLE_CLIENT_ID,
          clientSecret: c.env.APPLE_CLIENT_SECRET,
        };
      }
      if (c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET) {
        oauthProviders.github = {
          clientId: c.env.GITHUB_CLIENT_ID,
          clientSecret: c.env.GITHUB_CLIENT_SECRET,
        };
      }

      const additionalTrustedOrigins = c.env.TRUSTED_ORIGINS
        ? c.env.TRUSTED_ORIGINS.split(",")
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0)
        : [];

      authInstance = createAuthFn(
        db,
        c.env.BETTER_AUTH_SECRET,
        oauthProviders,
        c.env.APP_URL,
        additionalTrustedOrigins,
      );
      return authInstance;
    });

    await next();
  };
}
