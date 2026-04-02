import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { aiJobs, articles, summaries } from "../db/schema";
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
  HTTP_CREATED,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import type { RunPodConfig, SummaryJobStatus, SummaryResult } from "../services/summary";

const ARTICLE_NOT_FOUND_MESSAGE = "記事が見つかりません";
const SUMMARY_NOT_FOUND_MESSAGE = "要約が見つかりません";
const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";
const SUMMARY_GENERATION_ERROR_MESSAGE = "要約の生成に失敗しました";
const NO_CONTENT_ERROR_MESSAGE = "記事のコンテンツがありません";
const SUPPORTED_LANGUAGES = ["ja", "en", "zh", "ko"] as const;
const DEFAULT_LANGUAGE = "ja";

const CreateSummarySchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, {
    error: `languageは${SUPPORTED_LANGUAGES.join(", ")}のいずれかで指定してください`,
  }),
});

type SummarizeFn = (params: {
  content: string;
  language: string;
  config: RunPodConfig;
}) => Promise<SummaryResult>;

type CreateSummaryJobFn = (params: {
  content: string;
  language: string;
  config: RunPodConfig;
}) => Promise<{ providerJobId: string; model: string }>;

type GetSummaryJobStatusFn = (params: {
  providerJobId: string;
  config: RunPodConfig;
}) => Promise<SummaryJobStatus>;

type SummaryRouteOptions = {
  db: Database;
  summarizeFn: SummarizeFn;
  createSummaryJobFn: CreateSummaryJobFn;
  getSummaryJobStatusFn: GetSummaryJobStatusFn;
  runpodConfig: RunPodConfig;
};

function buildRequestKey(articleId: string, language: string): string {
  return `summary:${articleId}:${language}`;
}

function buildProgress(status: "queued" | "running" | "completed" | "failed"): number {
  if (status === "queued") return 15;
  if (status === "running") return 65;
  if (status === "completed") return 100;
  return 0;
}

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

export function createSummaryRoute(options: SummaryRouteOptions) {
  const { db, createSummaryJobFn, getSummaryJobStatusFn, runpodConfig } = options;
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
        { success: false, error: { code: INTERNAL_ERROR_CODE, message: NO_CONTENT_ERROR_MESSAGE } },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    const requestKey = buildRequestKey(articleId, language);
    const existingJobs =
      (await db
        .select()
        .from(aiJobs)
        .where(and(eq(aiJobs.requestKey, requestKey), eq(aiJobs.articleId, articleId)))) ?? [];
    existingJobs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const activeJob = existingJobs.find(
      (job) => job.status === "queued" || job.status === "running",
    );

    if (activeJob) {
      return c.json(
        {
          success: true,
          data: {
            status: activeJob.status,
            progress: buildProgress(activeJob.status as "queued" | "running"),
            jobId: activeJob.id,
          },
        },
        HTTP_OK,
      );
    }

    try {
      const createdJob = await createSummaryJobFn({
        content: article.content,
        language,
        config: runpodConfig,
      });

      const now = new Date();
      const jobId = crypto.randomUUID();
      await db.insert(aiJobs).values({
        id: jobId,
        articleId,
        requestKey,
        jobType: "summary",
        language,
        status: "queued",
        providerJobId: createdJob.providerJobId,
        model: createdJob.model,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      return c.json(
        {
          success: true,
          data: {
            status: "queued",
            progress: buildProgress("queued"),
            jobId,
          },
        },
        HTTP_CREATED,
      );
    } catch {
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

    if (!job.providerJobId) {
      return c.json({
        success: true,
        data: {
          status: "failed",
          progress: 0,
          jobId: job.id,
          error: job.errorMessage ?? SUMMARY_GENERATION_ERROR_MESSAGE,
        },
      });
    }

    try {
      const status = await getSummaryJobStatusFn({
        providerJobId: job.providerJobId,
        config: runpodConfig,
      });
      const now = new Date();

      if (status.status === "completed") {
        const existingSummary = await db
          .select()
          .from(summaries)
          .where(
            and(
              eq(summaries.articleId, articleId),
              eq(summaries.language, job.language ?? DEFAULT_LANGUAGE),
            ),
          );

        const summaryRecord =
          existingSummary[0] ??
          (
            await db
              .insert(summaries)
              .values({
                id: crypto.randomUUID(),
                articleId,
                language: job.language ?? DEFAULT_LANGUAGE,
                summary: status.summary,
                model: status.model,
                createdAt: now,
              })
              .returning()
          )[0];

        await db
          .update(aiJobs)
          .set({
            status: "completed",
            errorMessage: null,
            updatedAt: now,
            completedAt: now,
          })
          .where(eq(aiJobs.id, job.id));

        return c.json({
          success: true,
          data: {
            status: "completed",
            progress: 100,
            jobId: job.id,
            summary: summaryRecord,
          },
        });
      }

      if (status.status === "failed") {
        await db
          .update(aiJobs)
          .set({
            status: "failed",
            errorMessage: status.error,
            updatedAt: now,
          })
          .where(eq(aiJobs.id, job.id));

        return c.json({
          success: true,
          data: {
            status: "failed",
            progress: 0,
            jobId: job.id,
            error: status.error,
          },
        });
      }

      await db
        .update(aiJobs)
        .set({
          status: status.status,
          updatedAt: now,
        })
        .where(eq(aiJobs.id, job.id));

      return c.json({
        success: true,
        data: {
          status: status.status,
          progress: buildProgress(status.status),
          jobId: job.id,
        },
      });
    } catch {
      return c.json(
        {
          success: false,
          error: { code: INTERNAL_ERROR_CODE, message: SUMMARY_GENERATION_ERROR_MESSAGE },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
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
    const language = c.req.query("language") ?? DEFAULT_LANGUAGE;
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
