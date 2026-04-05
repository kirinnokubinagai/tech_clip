import { Hono } from "hono";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { getRunPodEndpointId } from "../lib/config";
import { createAiLimitMiddleware } from "../middleware/ai-limit";
import {
  createKvStore,
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIG,
} from "../middleware/rateLimit";
import { createAiRoute } from "../routes/ai";
import { createSummaryRoute } from "../routes/summary";
import { createSummaryJob, getSummaryJobStatus, summarizeArticle } from "../services/summary";
import {
  createTranslationJob,
  getTranslationJobStatus,
  translateArticle,
} from "../services/translator";
import type { Bindings } from "../types";

/**
 * AI（要約・翻訳）サブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param env - Cloudflare Workers バインディング
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleAi(
  db: Database,
  env: Bindings,
  auth: Auth,
  request: Request,
): Promise<Response> {
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

  const kvStore = createKvStore(env.RATE_LIMIT);
  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.use("/api/articles/:id/summary", createRateLimitMiddleware(RATE_LIMIT_CONFIG.ai, kvStore));
  subApp.use("/api/articles/:id/summary", createAiLimitMiddleware(db));
  subApp.use(
    "/api/articles/:id/translate",
    createRateLimitMiddleware(RATE_LIMIT_CONFIG.ai, kvStore),
  );
  subApp.use("/api/articles/:id/translate", createAiLimitMiddleware(db));

  subApp.route("/api", summaryRoute);
  subApp.route("/api/articles", aiRoute);

  return subApp.fetch(request);
}
