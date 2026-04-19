import { Hono } from "hono";

import type { Auth } from "../auth";
import type { Database } from "../db";
import { resolveUserFromRequest } from "./resolve-user";

/** 認証付きサブアプリの変数型 */
type AuthVariables = { Variables: { user?: Record<string, unknown> } };

/**
 * セッションミドルウェアを適用した認証済みサブアプリを生成し、
 * ルートをマウントして fetch レスポンスを返す。
 *
 * Better Auth Cookie または Authorization: Bearer <token>（独自 sessions テーブル）の
 * どちらでも認証可能。モバイルクライアントは Bearer を、Web は Cookie を使用する。
 *
 * @param db - データベースインスタンス（Bearer token 検証用）
 * @param auth - Better Auth インスタンス（Cookie セッション検証用）
 * @param mountRoutes - サブアプリにルートをマウントするコールバック
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function fetchWithAuth(
  db: Database,
  auth: Auth,
  mountRoutes: (subApp: Hono<AuthVariables>) => void,
  request: Request,
): Promise<Response> {
  const subApp = new Hono<AuthVariables>();

  subApp.use("*", async (ctx, next) => {
    const user = await resolveUserFromRequest(db, auth, ctx.req.raw.headers);
    if (user) {
      ctx.set("user", user);
    }
    await next();
  });

  mountRoutes(subApp);
  return subApp.fetch(request);
}
