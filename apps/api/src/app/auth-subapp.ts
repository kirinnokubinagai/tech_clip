import { Hono } from "hono";

import type { Auth } from "../auth";
import type { Database } from "../db";
import { fetchWithAuth } from "../lib/route-helpers";
import { createAuthRoute } from "../routes/auth";
import { createEmailVerificationRoute } from "../routes/email-verification";
import { createPasswordResetRoute } from "../routes/password-reset";
import type { Bindings } from "../types";

/** デフォルトのアプリ URL（ローカル開発用） */
const DEFAULT_APP_URL = "http://localhost:8081";

/**
 * 認証ルートのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleAuthRoute(
  db: Database,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const authRoute = createAuthRoute({
    db,
    getAuth: () => auth,
  });
  const subApp = new Hono();
  subApp.route("/api/auth", authRoute);
  return subApp.fetch(request);
}

/**
 * メール認証ルートのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param env - Cloudflare Workers バインディング
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleEmailVerification(
  db: Database,
  env: Bindings,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const appUrl = env.APP_URL ?? DEFAULT_APP_URL;
  const route = createEmailVerificationRoute({
    db,
    appUrl,
    emailEnv: { RESEND_API_KEY: env.RESEND_API_KEY, FROM_EMAIL: env.FROM_EMAIL },
  });

  return fetchWithAuth(
    auth.api.getSession.bind(auth.api),
    (subApp) => {
      subApp.route("/api/auth", route);
    },
    request,
  );
}

/**
 * 汎用認証ルート（パスワードリセット含む）のサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param env - Cloudflare Workers バインディング
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleAuthCatchAll(
  db: Database,
  env: Bindings,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  const isPasswordReset =
    request.method === "POST" &&
    (path === "/api/auth/forgot-password" || path === "/api/auth/reset-password");

  if (isPasswordReset) {
    const passwordResetRoute = createPasswordResetRoute({
      db,
      appUrl: env.APP_URL ?? DEFAULT_APP_URL,
      emailEnv: { RESEND_API_KEY: env.RESEND_API_KEY, FROM_EMAIL: env.FROM_EMAIL },
    });
    const subApp = new Hono();
    subApp.route("/api/auth", passwordResetRoute);
    return subApp.fetch(request);
  }

  return auth.handler(request);
}
