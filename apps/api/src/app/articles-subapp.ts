import { and, desc, eq, like, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { articles, users } from "../db/schema";
import { getRunPodEndpointId } from "../lib/config";
import { createAiLimitMiddleware } from "../middleware/ai-limit";
import {
  createKvStore,
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIG,
} from "../middleware/rateLimit";
import { createAiRoute } from "../routes/ai";
import { createArticlesRoute } from "../routes/articles";
import { createFavoriteRoute } from "../routes/favorite";
import { createPublicArticlesRoute } from "../routes/public-articles";
import { createSearchRoute, escapeLikeWildcards } from "../routes/search";
import { createSummaryRoute } from "../routes/summary";
import { parseArticle } from "../services/article-parser";
import { createSummaryJob, getSummaryJobStatus, summarizeArticle } from "../services/summary";
import {
  createTranslationJob,
  getTranslationJobStatus,
  translateArticle,
} from "../services/translator";
import type { Bindings } from "../types";

/**
 * 公開記事一覧サブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handlePublicArticles(db: Database, request: Request): Promise<Response> {
  const publicArticlesRoute = createPublicArticlesRoute({
    queryFn: async (params) => {
      const conditions = [eq(articles.userId, params.userId), eq(articles.isPublic, true)];
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
    userExistsFn: async (userId) => {
      const [found] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      return !!found;
    },
  });

  const subApp = new Hono();
  subApp.route("/api/users", publicArticlesRoute);

  return subApp.fetch(request);
}

/**
 * 記事ドメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param env - Cloudflare Workers バインディング
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleArticles(
  db: Database,
  env: Bindings,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const articlesRoute = createArticlesRoute({
    db,
    parseArticleFn: parseArticle,
    queryFn: async (params) => {
      const conditions = [eq(articles.userId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(articles.id, params.cursor));
      }
      if (params.source !== undefined) {
        conditions.push(eq(articles.source, params.source as string));
      }
      if (params.isFavorite !== undefined) {
        conditions.push(eq(articles.isFavorite, params.isFavorite));
      }
      if (params.isRead !== undefined) {
        conditions.push(eq(articles.isRead, params.isRead));
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

  const summaryRoute = createSummaryRoute({
    db,
    summarizeFn: summarizeArticle,
    createSummaryJobFn: createSummaryJob,
    getSummaryJobStatusFn: getSummaryJobStatus,
    runpodConfig: {
      apiKey: env.RUNPOD_API_KEY,
      endpointId: getRunPodEndpointId(env),
    },
  });

  const aiRoute = createAiRoute({
    db,
    translateArticleFn: translateArticle,
    createTranslationJobFn: createTranslationJob,
    getTranslationJobStatusFn: getTranslationJobStatus,
    runpodConfig: {
      apiKey: env.RUNPOD_API_KEY,
      endpointId: getRunPodEndpointId(env),
    },
  });

  const favoriteRoute = createFavoriteRoute({ db });

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

  subApp.use("/api/articles", createRateLimitMiddleware(RATE_LIMIT_CONFIG.articleSave, kvStore));
  subApp.use(
    "/api/articles/:id",
    createRateLimitMiddleware(RATE_LIMIT_CONFIG.articleSave, kvStore),
  );

  subApp.use("/api/articles/:id/summary", createRateLimitMiddleware(RATE_LIMIT_CONFIG.ai, kvStore));
  subApp.use("/api/articles/:id/summary", createAiLimitMiddleware(db));
  subApp.use(
    "/api/articles/:id/translate",
    createRateLimitMiddleware(RATE_LIMIT_CONFIG.ai, kvStore),
  );
  subApp.use("/api/articles/:id/translate", createAiLimitMiddleware(db));

  subApp.route("/api/articles", articlesRoute);
  subApp.route("/api", summaryRoute);
  subApp.route("/api/articles", aiRoute);
  subApp.route("/api/articles", favoriteRoute);
  subApp.route("/api/articles", searchRoute);

  return subApp.fetch(request);
}
