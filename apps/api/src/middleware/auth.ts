import type { MiddlewareHandler } from "hono";

import { AUTH_ERROR_CODE, AUTH_ERROR_MESSAGE } from "../lib/error-codes";
import { HTTP_UNAUTHORIZED } from "../lib/http-status";

/**
 * Better Auth セッション検証用の型定義
 */
type AuthInstance = {
  api: {
    getSession: (options: { headers: Headers }) => Promise<{
      session: Record<string, unknown>;
      user: Record<string, unknown>;
    } | null>;
  };
};

/**
 * Better Auth 認証ミドルウェアを生成する
 *
 * AuthorizationヘッダーまたはCookieからセッショントークンを取得し、
 * Better Auth の getSession API でセッションを検証する。
 * 認証済みの場合、user と session を Hono Context にセットする。
 * 未認証の場合は 401 エラーレスポンスを返す。
 *
 * @param getAuth - Better Auth インスタンスを取得するファクトリ関数
 * @returns Hono ミドルウェアハンドラー
 */
export function createAuthMiddleware(getAuth: () => AuthInstance): MiddlewareHandler {
  return async (c, next) => {
    const auth = getAuth();

    const result = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!result) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    c.set("user", result.user);
    c.set("session", result.session);

    await next();
  };
}
