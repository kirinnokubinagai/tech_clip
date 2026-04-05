import { and, desc, eq, lt } from "drizzle-orm";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { notifications } from "../db/schema";
import { toRecordArray } from "../lib/db-cast";
import { fetchWithAuth } from "../lib/route-helpers";
import { createNotificationSettingsRoute } from "../routes/notification-settings";
import { createNotificationsRoute } from "../routes/notifications";

/**
 * 通知ドメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleNotifications(
  db: Database,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const notificationsRoute = createNotificationsRoute({
    db,
    queryFn: async (params) => {
      const conditions = [eq(notifications.userId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(notifications.id, params.cursor));
      }
      const results = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(params.limit);
      return toRecordArray(results);
    },
  });

  return fetchWithAuth(
    auth.api.getSession.bind(auth.api),
    (subApp) => {
      subApp.route("/api", notificationsRoute);
    },
    request,
  );
}

/**
 * 通知設定ドメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleNotificationSettings(
  db: Database,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const notificationSettingsRoute = createNotificationSettingsRoute({ db });

  return fetchWithAuth(
    auth.api.getSession.bind(auth.api),
    (subApp) => {
      subApp.route("/api", notificationSettingsRoute);
    },
    request,
  );
}
