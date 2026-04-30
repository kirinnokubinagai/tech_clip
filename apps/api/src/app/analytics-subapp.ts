import type { Auth } from "../auth";
import type { Database } from "../db";
import { fetchWithAuth } from "../lib/route-helpers";
import { createAnalyticsRoute } from "../routes/analytics";

/**
 * アナリティクスドメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleAnalytics(
  db: Database,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const analyticsRoute = createAnalyticsRoute({ db });

  return fetchWithAuth(
    db,
    auth,
    (subApp) => {
      subApp.route("/api/analytics", analyticsRoute);
    },
    request,
  );
}
