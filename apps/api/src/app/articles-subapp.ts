import { and, desc, eq, lt, or, type SQL, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { Auth } from "../auth";
import type { Database } from "../db";
import { articles, users } from "../db/schema";
import type { User } from "../db/schema/users";
import { resolveGemmaModelTag } from "../lib/ai-model";
import { toRecordArray } from "../lib/db-cast";
import { resolveUserFromRequest } from "../lib/resolve-user";
import { createAiLimitMiddleware } from "../middleware/ai-limit";
import {
  createKvStore,
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIG,
} from "../middleware/rateLimit";
import { createAiRoute } from "../routes/ai";
import { createArticlesRoute } from "../routes/articles";
import { createFavoriteRoute } from "../routes/favorite";
import { createFeedRoute } from "../routes/feed";
import { createPublicArticlesRoute } from "../routes/public-articles";
import { buildFtsMatchExpression, createSearchRoute } from "../routes/search";
import { createSummaryRoute } from "../routes/summary";
import { fetchArticleMetadata } from "../services/metadata-fetcher";
import { summarizeArticle } from "../services/summary";
import { translateArticle } from "../services/translator";
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
        try {
          const cur = JSON.parse(atob(params.cursor)) as {
            createdAt: string;
            id: string;
          };
          const cursorDate = new Date(cur.createdAt);
          conditions.push(
            or(
              lt(articles.createdAt, cursorDate),
              and(sql`${articles.createdAt} = ${cursorDate}`, lt(articles.id, cur.id)),
            ) as SQL,
          );
        } catch {
          conditions.push(lt(articles.id, params.cursor));
        }
      }
      const results = await db
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.createdAt), desc(articles.id))
        .limit(params.limit);
      return toRecordArray(results);
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
    parseArticleFn: fetchArticleMetadata,
    queryFn: async (params) => {
      const conditions = [eq(articles.userId, params.userId)];
      if (params.cursor) {
        try {
          const cur = JSON.parse(atob(params.cursor)) as {
            createdAt: string;
            id: string;
          };
          const cursorDate = new Date(cur.createdAt);
          conditions.push(
            or(
              lt(articles.createdAt, cursorDate),
              and(sql`${articles.createdAt} = ${cursorDate}`, lt(articles.id, cur.id)),
            ) as SQL,
          );
        } catch {
          conditions.push(lt(articles.id, params.cursor));
        }
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
        .orderBy(desc(articles.createdAt), desc(articles.id))
        .limit(params.limit);
      return toRecordArray(results);
    },
  });

  const gemmaModelTag = resolveGemmaModelTag(env.GEMMA_MODEL_NAME);

  const summaryRoute = createSummaryRoute({
    db,
    summarizeFn: summarizeArticle,
    ai: env.AI,
    modelTag: gemmaModelTag,
    cache: env.CACHE,
  });

  const aiRoute = createAiRoute({
    db,
    ai: env.AI,
    modelTag: gemmaModelTag,
    cache: env.CACHE,
    translateFn: translateArticle,
  });

  const favoriteRoute = createFavoriteRoute({ db });

  const feedRoute = createFeedRoute({ db });

  const searchRoute = createSearchRoute({
    searchQueryFn: async (params) => {
      const matchExpr = buildFtsMatchExpression(params.query);
      if (matchExpr === null) {
        return [];
      }
      const conditions = [
        eq(articles.userId, params.userId),
        sql`articles.rowid IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ${matchExpr})`,
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
      return toRecordArray(results);
    },
  });

  const kvStore = createKvStore(env.RATE_LIMIT);
  const subApp = new Hono<{ Variables: { user?: User } }>();

  subApp.use("*", async (ctx, next) => {
    const user = await resolveUserFromRequest(db, auth, ctx.req.raw.headers);
    if (user) {
      ctx.set("user", user);
    }
    await next();
  });

  /** 記事保存（POST/PATCH）のレート制限（30リクエスト/分） */
  subApp.use("/api/articles", createRateLimitMiddleware(RATE_LIMIT_CONFIG.articleSave, kvStore));
  subApp.use(
    "/api/articles/:id",
    createRateLimitMiddleware(RATE_LIMIT_CONFIG.articleSave, kvStore),
  );

  /** AI（要約・翻訳）ルートのレート制限（10リクエスト/分）とAI使用回数制限 */
  subApp.use("/api/articles/:id/summary", createRateLimitMiddleware(RATE_LIMIT_CONFIG.ai, kvStore));
  subApp.use("/api/articles/:id/summary", createAiLimitMiddleware(db));
  subApp.use(
    "/api/articles/:id/translate",
    createRateLimitMiddleware(RATE_LIMIT_CONFIG.ai, kvStore),
  );
  subApp.use("/api/articles/:id/translate", createAiLimitMiddleware(db));

  subApp.route("/api", feedRoute);
  // searchRoute は articlesRoute (:id パス) より先にマウント
  // （/api/articles/search が /api/articles/:id にマッチしてしまう競合回避）
  subApp.route("/api/articles", searchRoute);
  subApp.route("/api/articles", articlesRoute);
  subApp.route("/api", summaryRoute);
  subApp.route("/api/articles", aiRoute);
  subApp.route("/api/articles", favoriteRoute);

  return subApp.fetch(request);
}
