import { Hono } from "hono";

/** セッション取得関数の型 */
type GetSessionFn = (opts: {
  headers: Headers;
}) => Promise<{ user: Record<string, unknown> } | null>;

/** 認証付きサブアプリの変数型 */
type AuthVariables = { Variables: { user?: Record<string, unknown> } };

/**
 * セッションミドルウェアを適用した認証済みサブアプリを生成し、
 * ルートをマウントして fetch レスポンスを返す
 *
 * @param getSession - セッション取得関数（Better Auth の api.getSession）
 * @param mountRoutes - サブアプリにルートをマウントするコールバック
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function fetchWithAuth(
  getSession: GetSessionFn,
  mountRoutes: (subApp: Hono<AuthVariables>) => void,
  request: Request,
): Promise<Response> {
  const subApp = new Hono<AuthVariables>();

  subApp.use("*", async (ctx, next) => {
    const result = await getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  mountRoutes(subApp);

  return subApp.fetch(request);
}
