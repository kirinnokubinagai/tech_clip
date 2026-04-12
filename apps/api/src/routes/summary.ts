import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { aiJobs, articles, summaries } from "../db/schema";
import { DEFAULT_GEMMA_MODEL_TAG } from "../lib/ai-model";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  FORBIDDEN_ERROR_CODE,
  FORBIDDEN_ERROR_MESSAGE,
  NOT_FOUND_ERROR_CODE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import {
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { createLogger } from "../lib/logger";
import type { SummaryResult } from "../services/summary";
import { SUPPORTED_LANGUAGES } from "../validators/ai";

const ARTICLE_NOT_FOUND_MESSAGE = "記事が見つかりません";
const SUMMARY_NOT_FOUND_MESSAGE = "要約が見つかりません";
const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";
const SUMMARY_GENERATION_ERROR_MESSAGE = "要約の生成に失敗しました";
const NO_CONTENT_ERROR_MESSAGE = "記事のコンテンツがありません";
const DEFAULT_LANGUAGE = "ja";

/** KV キャッシュに保存する要約データの形式 */
type CachedSummary = {
  summary: string;
  model: string;
  createdAt: string;
};

/** KV キャッシュ TTL（90日 = 秒単位） */
const KV_CACHE_TTL_SECONDS = 60 * 60 * 24 * 90;

const CreateSummarySchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, {
    error: `languageは${SUPPORTED_LANGUAGES.join(", ")}のいずれかで指定してください`,
  }),
});

type SummarizeFn = (params: {
  ai: Ai;
  content: string;
  language: (typeof SUPPORTED_LANGUAGES)[number];
  modelTag?: string;
}) => Promise<SummaryResult>;

type SummaryRouteOptions = {
  db: Database;
  summarizeFn: SummarizeFn;
  ai: Ai;
  modelTag?: string;
  /** env.CACHE KV namespace（テストでは省略可） */
  cache?: KVNamespace;
};

/**
 * KV キャッシュキーを生成する
 *
 * @param articleId - 記事ID
 * @param language - 言語コード
 * @returns KV キャッシュキー
 */
function buildKvKey(articleId: string, language: string): string {
  return `summary:v1:${articleId}:${language}`;
}

/**
 * KV キャッシュから要約データを取得する
 *
 * @param cache - KV namespace（省略可）
 * @param articleId - 記事ID
 * @param language - 言語コード
 * @returns キャッシュされた要約データ、またはnull
 */
async function getCachedSummary(
  cache: KVNamespace | undefined,
  articleId: string,
  language: string,
): Promise<CachedSummary | null> {
  if (!cache) {
    return null;
  }
  const raw = await cache.get(buildKvKey(articleId, language));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CachedSummary;
  } catch {
    return null;
  }
}

/**
 * ステータスに対応するプログレス値を返す
 *
 * @param status - ジョブステータス
 * @returns プログレス値（0-100）
 */
function buildProgress(status: "queued" | "running" | "completed" | "failed"): number {
  if (status === "queued") return 15;
  if (status === "running") return 65;
  if (status === "completed") return 100;
  return 0;
}

/**
 * 記事の所有者チェックを行う
 *
 * @param db - データベースインスタンス
 * @param articleId - 記事ID
 * @param userId - ユーザーID
 * @returns 記事オブジェクト、またはエラー種別
 */
async function ensureOwnedArticle(db: Database, articleId: string, userId: string) {
  const articleResults = await db.select().from(articles).where(eq(articles.id, articleId));

  if (articleResults.length === 0) {
    return { error: "not_found" as const };
  }

  const article = articleResults[0];
  if (article.userId !== userId) {
    return { error: "forbidden" as const };
  }

  return { article };
}

/**
 * 要約ルートを生成する
 *
 * @param options - ルートオプション
 * @returns Hono ルートインスタンス
 */
export function createSummaryRoute(options: SummaryRouteOptions) {
  const { db, summarizeFn, ai, modelTag, cache } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/articles/:id/summary", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        { success: false, error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE } },
        HTTP_UNAUTHORIZED,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const validation = CreateSummarySchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: validation.error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const articleId = c.req.param("id");
    const { language } = validation.data;
    const ownership = await ensureOwnedArticle(db, articleId, user.id as string);

    if ("error" in ownership) {
      if (ownership.error === "not_found") {
        return c.json(
          {
            success: false,
            error: { code: NOT_FOUND_ERROR_CODE, message: ARTICLE_NOT_FOUND_MESSAGE },
          },
          HTTP_NOT_FOUND,
        );
      }
      return c.json(
        { success: false, error: { code: FORBIDDEN_ERROR_CODE, message: FORBIDDEN_ERROR_MESSAGE } },
        HTTP_FORBIDDEN,
      );
    }

    const article = ownership.article;

    const cached = await getCachedSummary(cache, articleId, language);
    if (cached) {
      return c.json(
        {
          success: true,
          data: {
            status: "completed",
            progress: 100,
            jobId: null,
            summary: {
              articleId,
              language,
              summary: cached.summary,
              model: cached.model,
              createdAt: cached.createdAt,
            },
          },
        },
        HTTP_OK,
      );
    }

    const existingSummaries = await db
      .select()
      .from(summaries)
      .where(and(eq(summaries.articleId, articleId), eq(summaries.language, language)));

    if (existingSummaries.length > 0) {
      const existing = existingSummaries[0];
      return c.json(
        {
          success: true,
          data: {
            status: "completed",
            progress: 100,
            jobId: null,
            summary: existing,
          },
        },
        HTTP_OK,
      );
    }

    if (!article.content) {
      return c.json(
        {
          success: false,
          error: { code: VALIDATION_ERROR_CODE, message: NO_CONTENT_ERROR_MESSAGE },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const startedAt = new Date();
    const jobId = crypto.randomUUID();
    await db.insert(aiJobs).values({
      id: jobId,
      articleId,
      requestKey: buildKvKey(articleId, language),
      jobType: "summary",
      language,
      status: "running",
      providerJobId: null,
      model: modelTag ?? DEFAULT_GEMMA_MODEL_TAG,
      errorMessage: null,
      createdAt: startedAt,
      updatedAt: startedAt,
      completedAt: null,
    });

    try {
      const result = await summarizeFn({
        ai,
        content: article.content,
        language,
        modelTag,
      });

      const completedAt = new Date();

      const [summaryRecord] = await db
        .insert(summaries)
        .values({
          id: crypto.randomUUID(),
          articleId,
          language,
          summary: result.summary,
          model: result.model,
          createdAt: completedAt,
        })
        .returning();

      await db
        .update(aiJobs)
        .set({
          status: "completed",
          errorMessage: null,
          updatedAt: completedAt,
          completedAt,
        })
        .where(eq(aiJobs.id, jobId));

      if (cache) {
        try {
          await cache.put(
            buildKvKey(articleId, language),
            JSON.stringify({
              summary: result.summary,
              model: result.model,
              createdAt: completedAt.toISOString(),
            }),
            { expirationTtl: KV_CACHE_TTL_SECONDS },
          );
        } catch (cacheError) {
          const cacheLogger = createLogger("summary-route");
          cacheLogger.warn("KV キャッシュ書き込みに失敗しました", {
            articleId,
            language,
            error:
              cacheError instanceof Error
                ? { name: cacheError.name, message: cacheError.message }
                : cacheError,
          });
        }
      }

      return c.json(
        {
          success: true,
          data: {
            status: "completed",
            progress: 100,
            jobId,
            summary: summaryRecord,
          },
        },
        HTTP_OK,
      );
    } catch (error) {
      const logger = createLogger("summary-route");
      logger.error("要約生成に失敗しました", {
        articleId,
        language,
        jobId,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      });

      const failedAt = new Date();
      try {
        await db
          .update(aiJobs)
          .set({
            status: "failed",
            errorMessage:
              error instanceof Error
                ? `${error.name}: ${error.message}`.slice(0, 500)
                : SUMMARY_GENERATION_ERROR_MESSAGE,
            updatedAt: failedAt,
          })
          .where(eq(aiJobs.id, jobId));
      } catch (dbError) {
        const dbLogger = createLogger("summary-route");
        dbLogger.error("aiJobs 失敗ステータス更新に失敗", {
          jobId,
          error:
            dbError instanceof Error ? { name: dbError.name, message: dbError.message } : dbError,
        });
      }

      return c.json(
        {
          success: false,
          error: { code: INTERNAL_ERROR_CODE, message: SUMMARY_GENERATION_ERROR_MESSAGE },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.get("/articles/:id/summary/jobs/:jobId", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        { success: false, error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE } },
        HTTP_UNAUTHORIZED,
      );
    }

    const articleId = c.req.param("id");
    const jobId = c.req.param("jobId");
    const ownership = await ensureOwnedArticle(db, articleId, user.id as string);

    if ("error" in ownership) {
      if (ownership.error === "not_found") {
        return c.json(
          {
            success: false,
            error: { code: NOT_FOUND_ERROR_CODE, message: ARTICLE_NOT_FOUND_MESSAGE },
          },
          HTTP_NOT_FOUND,
        );
      }
      return c.json(
        { success: false, error: { code: FORBIDDEN_ERROR_CODE, message: FORBIDDEN_ERROR_MESSAGE } },
        HTTP_FORBIDDEN,
      );
    }

    const jobResults = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId));
    if (
      jobResults.length === 0 ||
      jobResults[0].articleId !== articleId ||
      jobResults[0].jobType !== "summary"
    ) {
      return c.json(
        {
          success: false,
          error: { code: NOT_FOUND_ERROR_CODE, message: SUMMARY_NOT_FOUND_MESSAGE },
        },
        HTTP_NOT_FOUND,
      );
    }

    const job = jobResults[0];

    if (job.status === "completed") {
      const cachedSummary = await db
        .select()
        .from(summaries)
        .where(
          and(
            eq(summaries.articleId, articleId),
            eq(summaries.language, job.language ?? DEFAULT_LANGUAGE),
          ),
        );
      if (cachedSummary.length > 0) {
        return c.json({
          success: true,
          data: {
            status: "completed",
            progress: 100,
            jobId: job.id,
            summary: cachedSummary[0],
          },
        });
      }
    }

    if (job.status === "failed") {
      return c.json({
        success: true,
        data: {
          status: "failed",
          progress: 0,
          jobId: job.id,
          error: SUMMARY_GENERATION_ERROR_MESSAGE,
        },
      });
    }

    return c.json({
      success: true,
      data: {
        status: job.status,
        progress: buildProgress(job.status as "queued" | "running" | "completed" | "failed"),
        jobId: job.id,
      },
    });
  });

  route.get("/articles/:id/summary", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        { success: false, error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE } },
        HTTP_UNAUTHORIZED,
      );
    }

    const articleId = c.req.param("id");
    const rawLanguage = c.req.query("language") ?? DEFAULT_LANGUAGE;
    const languageParseResult = CreateSummarySchema.safeParse({ language: rawLanguage });
    if (!languageParseResult.success) {
      return c.json(
        {
          success: false,
          error: { code: VALIDATION_ERROR_CODE, message: "language が不正です" },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }
    const language = languageParseResult.data.language;
    const ownership = await ensureOwnedArticle(db, articleId, user.id as string);

    if ("error" in ownership) {
      if (ownership.error === "not_found") {
        return c.json(
          {
            success: false,
            error: { code: NOT_FOUND_ERROR_CODE, message: ARTICLE_NOT_FOUND_MESSAGE },
          },
          HTTP_NOT_FOUND,
        );
      }
      return c.json(
        { success: false, error: { code: FORBIDDEN_ERROR_CODE, message: FORBIDDEN_ERROR_MESSAGE } },
        HTTP_FORBIDDEN,
      );
    }

    const summaryResults = await db
      .select()
      .from(summaries)
      .where(and(eq(summaries.articleId, articleId), eq(summaries.language, language)));

    if (summaryResults.length === 0) {
      return c.json(
        {
          success: false,
          error: { code: NOT_FOUND_ERROR_CODE, message: SUMMARY_NOT_FOUND_MESSAGE },
        },
        HTTP_NOT_FOUND,
      );
    }

    return c.json({ success: true, data: summaryResults[0] }, HTTP_OK);
  });

  return route;
}
