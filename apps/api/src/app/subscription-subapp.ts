import type { Auth } from "../auth";
import type { Database } from "../db";
import { fetchWithAuth } from "../lib/route-helpers";
import { createSubscriptionRoute } from "../routes/subscription";
import type { Bindings } from "../types";

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
