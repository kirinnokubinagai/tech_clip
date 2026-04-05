import { and, desc, eq, like, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { articles } from "../db/schema";
import {
  createKvStore,
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIG,
} from "../middleware/rateLimit";
import { createSearchRoute, escapeLikeWildcards } from "../routes/search";
import type { Bindings } from "../types";

/**
 * 検索サブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param env - Cloudflare Workers バインディング
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleSearch(
  db: Database,
  env: Bindings,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const searchRoute = createSearchRoute({
    searchQueryFn: async (params) => {
      const keyword = `%${escapeLikeWildcards(params.query)}%`;
      const conditions = [
        eq(articles.userId, params.userId),
        or(
          like(articles.title, keyword),
          like(articles.content, keyword),
          like(articles.excerpt, keyword),
        ),
      ];
      if (params.cursor) {
        conditions.push(lt(articles.id, params.cursor));
      }
      const results = await db
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.createdAt))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
  });

  const kvStore = createKvStore(env.RATE_LIMIT);
  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.use(
    "/api/articles/search",
    createRateLimitMiddleware(RATE_LIMIT_CONFIG.articleSave, kvStore),
  );

  subApp.route("/api/articles", searchRoute);

  return subApp.fetch(request);
}
