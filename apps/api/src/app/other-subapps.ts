import type { Auth } from "../auth";
import type { Database } from "../db";
import { fetchWithAuth } from "../lib/route-helpers";
import { createAnalyticsRoute } from "../routes/analytics";
import { createSubscriptionRoute } from "../routes/subscription";
import { createTagsRoute } from "../routes/tags";
import type { Bindings } from "../types";

/**
 * タグドメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleTags(db: Database, auth: Auth, request: Request): Promise<Response> {
  const tagsRoute = createTagsRoute({ db });

  return fetchWithAuth(
    auth.api.getSession.bind(auth.api),
    (subApp) => {
      subApp.route("/api", tagsRoute);
    },
    request,
  );
}

/**
 * サブスクリプションドメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param env - Cloudflare Workers バインディング
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleSubscription(
  db: Database,
  env: Bindings,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const subscriptionRoute = createSubscriptionRoute({
    db,
    webhookSecret: env.REVENUECAT_WEBHOOK_SECRET ?? "",
  });

  return fetchWithAuth(
    auth.api.getSession.bind(auth.api),
    (subApp) => {
      subApp.route("/api/subscription", subscriptionRoute);
    },
    request,
  );
}

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
    auth.api.getSession.bind(auth.api),
    (subApp) => {
      subApp.route("/api/analytics", analyticsRoute);
    },
    request,
  );
}
