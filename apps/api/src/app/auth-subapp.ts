import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { Auth } from "../auth";
import type { Database } from "../db";
import { refreshTokens, sessions } from "../db/schema";
import { fetchWithAuth } from "../lib/route-helpers";
import { createAuthRoute } from "../routes/auth";
import { createEmailVerificationRoute } from "../routes/email-verification";
import { createPasswordResetRoute } from "../routes/password-reset";
import type { EmailEnv } from "../services/emailService";
import type { Bindings } from "../types";

/** デフォルトのアプリ URL（ローカル開発用） */
const DEFAULT_APP_URL = "http://localhost:8081";

/** モバイルアプリの deep link スキーム */
const MOBILE_CALLBACK_URL = "techclip://auth/callback";

/** リフレッシュトークンのバイト数 */
const REFRESH_TOKEN_BYTES = 24;

/**
 * ランダムなリフレッシュトークン文字列を生成する
 *
 * @returns 平文のリフレッシュトークン（16進数 48 文字）
 */
function generateRefreshToken(): string {
  const bytes = new Uint8Array(REFRESH_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * リフレッシュトークンを SHA-256 でハッシュ化する
 *
 * @param token - 平文のリフレッシュトークン
 * @returns 16進文字列のハッシュ値
 */
async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
}

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
  const emailEnv: EmailEnv = {
    RESEND_API_KEY: env.RESEND_API_KEY,
    FROM_EMAIL: env.FROM_EMAIL,
    MAILPIT_URL: env.MAILPIT_URL,
  };
  const route = createEmailVerificationRoute({
    db,
    appUrl,
    emailEnv,
  });

  return fetchWithAuth(
    db,
    auth,
    (subApp) => {
      subApp.route("/api/auth", route);
    },
    request,
  );
}

/**
 * OAuth ソーシャルログイン後にモバイルアプリへ deep link リダイレクトするハンドラ
 *
 * Better Auth は OAuth callback 後にセッションクッキーを設定してからこのエンドポイントへ
 * リダイレクトする。セッションクッキーからセッション情報を取得し、独自の
 * refresh token を発行して `techclip://auth/callback?token=...&refresh_token=...` へ
 * 302 リダイレクトする。
 *
 * エラー時は `techclip://auth/callback?error=...` へリダイレクトする。
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト（Better Auth のセッションクッキーが含まれる）
 * @returns 302 リダイレクトレスポンス
 */
export async function handleMobileOAuthCallback(
  db: Database,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const errorRedirect = (code: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${MOBILE_CALLBACK_URL}?error=${encodeURIComponent(code)}` },
    });

  let baSession: Awaited<ReturnType<Auth["api"]["getSession"]>>;
  try {
    baSession = await auth.api.getSession({ headers: request.headers });
  } catch {
    return errorRedirect("session_error");
  }

  if (!baSession?.session?.token) {
    return errorRedirect("no_session");
  }

  const sessionToken = baSession.session.token;

  const [sessionRow] = await db.select().from(sessions).where(eq(sessions.token, sessionToken));

  if (!sessionRow) {
    return errorRedirect("session_not_found");
  }

  const plainRefreshToken = generateRefreshToken();
  const tokenHash = await hashToken(plainRefreshToken);

  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    sessionId: sessionRow.id,
    userId: sessionRow.userId,
    tokenHash,
    expiresAt: sessionRow.expiresAt,
  });

  const params = new URLSearchParams({
    token: sessionToken,
    refresh_token: plainRefreshToken,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `${MOBILE_CALLBACK_URL}?${params.toString()}` },
  });
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
    const emailEnv: EmailEnv = {
      RESEND_API_KEY: env.RESEND_API_KEY,
      FROM_EMAIL: env.FROM_EMAIL,
      MAILPIT_URL: env.MAILPIT_URL,
    };
    const passwordResetRoute = createPasswordResetRoute({
      db,
      appUrl: env.APP_URL ?? DEFAULT_APP_URL,
      emailEnv,
      auth,
    });
    const subApp = new Hono();
    subApp.route("/api/auth", passwordResetRoute);
    return subApp.fetch(request);
  }

  if (path === "/api/auth/mobile-callback") {
    return handleMobileOAuthCallback(db, auth, request);
  }

  return auth.handler(request);
}
