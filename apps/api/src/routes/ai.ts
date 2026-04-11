import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";

import type { Database } from "../db";
import { aiJobs, articles, translations } from "../db/schema";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  FORBIDDEN_ERROR_CODE,
  FORBIDDEN_ERROR_MESSAGE,
  INTERNAL_ERROR_CODE,
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
import type {
  TranslateOptions,
  TranslationJobStatus,
  TranslationResult,
} from "../services/translator";
import { GenerateTranslationSchema } from "../validators/ai";

const ARTICLE_NOT_FOUND_MESSAGE = "記事が見つかりません";
const TRANSLATION_NOT_FOUND_MESSAGE = "翻訳が見つかりません";
const TRANSLATION_ERROR_MESSAGE = "翻訳処理に失敗しました";
const NO_CONTENT_MESSAGE = "翻訳するコンテンツがありません";
const DEFAULT_TARGET_LANGUAGE = "en";

type TranslateArticleFn = (options: TranslateOptions) => Promise<TranslationResult>;
type CreateTranslationJobFn = (
  options: TranslateOptions,
) => Promise<{ providerJobId: string; model: string }>;
type GetTranslationJobStatusFn = (params: {
  providerJobId: string;
  content: string;
  runpodApiKey: string;
  runpodEndpointId: string;
  modelTag?: string;
}) => Promise<TranslationJobStatus>;

type RunpodConfig = {
  apiKey: string;
  endpointId: string;
  /** データベース保存用のモデルタグ（省略時は DEFAULT_GEMMA_MODEL_TAG を使用） */
  modelTag?: string;
};

/** 認証済みユーザーの型 */
type AuthUser = {
  id: string;
  [key: string]: unknown;
};

type AiRouteOptions = {
  db: Database;
  translateArticleFn: TranslateArticleFn;
  createTranslationJobFn: CreateTranslationJobFn;
  getTranslationJobStatusFn: GetTranslationJobStatusFn;
  runpodConfig: RunpodConfig;
};

/**
 * 記事IDと言語からリクエストキーを生成する
 *
 * @param articleId - 記事ID
 * @param targetLanguage - 翻訳先言語
 * @returns リクエストキー文字列
 */
function buildRequestKey(articleId: string, targetLanguage: string): string {
  return `translation:${articleId}:${targetLanguage}`;
}

/** ジョブステータスごとの進捗値（パーセント） */
const PROGRESS_VALUES = {
  queued: 15,
  running: 65,
  completed: 100,
  failed: 0,
} as const;

function buildProgress(status: "queued" | "running" | "completed" | "failed"): number {
  return PROGRESS_VALUES[status] ?? 0;
}

/**
 * 記事が存在し、指定ユーザーの所有であることを確認する
 *
 * @param db - データベースインスタンス
 * @param articleId - 確認する記事ID
 * @param userId - 確認するユーザーID
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

export function createAiRoute(options: AiRouteOptions) {
  const { db, createTranslationJobFn, getTranslationJobStatusFn, runpodConfig } = options;
  const route = new Hono<{ Variables: { user?: AuthUser } }>();

  route.post("/:id/translate", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        { success: false, error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE } },
        HTTP_UNAUTHORIZED,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const validation = GenerateTranslationSchema.safeParse(body);
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
    const { targetLanguage } = validation.data;
    const ownership = await ensureOwnedArticle(db, articleId, user.id);

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
    const existingTranslations = await db
      .select()
      .from(translations)
      .where(
        and(eq(translations.articleId, articleId), eq(translations.targetLanguage, targetLanguage)),
      );

    if (existingTranslations.length > 0) {
      return c.json({
        success: true,
        data: {
          status: "completed",
          progress: 100,
          jobId: null,
          translation: existingTranslations[0],
        },
      });
    }

    if (!article.content) {
      return c.json(
        { success: false, error: { code: VALIDATION_ERROR_CODE, message: NO_CONTENT_MESSAGE } },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const requestKey = buildRequestKey(articleId, targetLanguage);
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
      return c.json({
        success: true,
        data: {
          status: activeJob.status,
          progress: buildProgress(activeJob.status as "queued" | "running"),
          jobId: activeJob.id,
        },
      });
    }

    try {
      const createdJob = await createTranslationJobFn({
        title: article.title,
        content: article.content,
        targetLanguage,
        runpodApiKey: runpodConfig.apiKey,
        runpodEndpointId: runpodConfig.endpointId,
        modelTag: runpodConfig.modelTag,
      });

      const now = new Date();
      const jobId = ulid();
      await db.insert(aiJobs).values({
        id: jobId,
        articleId,
        requestKey,
        jobType: "translation",
        language: targetLanguage,
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
          error: { code: INTERNAL_ERROR_CODE, message: TRANSLATION_ERROR_MESSAGE },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.get("/:id/translate/jobs/:jobId", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        { success: false, error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE } },
        HTTP_UNAUTHORIZED,
      );
    }

    const articleId = c.req.param("id");
    const jobId = c.req.param("jobId");
    const ownership = await ensureOwnedArticle(db, articleId, user.id);

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
    const jobResults = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId));
    if (
      jobResults.length === 0 ||
      jobResults[0].articleId !== articleId ||
      jobResults[0].jobType !== "translation"
    ) {
      return c.json(
        {
          success: false,
          error: { code: NOT_FOUND_ERROR_CODE, message: TRANSLATION_NOT_FOUND_MESSAGE },
        },
        HTTP_NOT_FOUND,
      );
    }

    const job = jobResults[0];
    if (job.status === "completed") {
      const cachedTranslation = await db
        .select()
        .from(translations)
        .where(
          and(
            eq(translations.articleId, articleId),
            eq(translations.targetLanguage, job.language ?? DEFAULT_TARGET_LANGUAGE),
          ),
        );
      if (cachedTranslation.length > 0) {
        return c.json({
          success: true,
          data: {
            status: "completed",
            progress: 100,
            jobId: job.id,
            translation: cachedTranslation[0],
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
          error: job.errorMessage ?? TRANSLATION_ERROR_MESSAGE,
        },
      });
    }

    try {
      const status = await getTranslationJobStatusFn({
        providerJobId: job.providerJobId,
        content: article.content ?? "",
        runpodApiKey: runpodConfig.apiKey,
        runpodEndpointId: runpodConfig.endpointId,
        modelTag: runpodConfig.modelTag,
      });
      const now = new Date();

      if (status.status === "completed") {
        const existingTranslation = await db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.articleId, articleId),
              eq(translations.targetLanguage, job.language ?? DEFAULT_TARGET_LANGUAGE),
            ),
          );

        const translationRecord =
          existingTranslation[0] ??
          (
            await db
              .insert(translations)
              .values({
                id: ulid(),
                articleId,
                targetLanguage: job.language ?? DEFAULT_TARGET_LANGUAGE,
                translatedTitle: status.translatedTitle,
                translatedContent: status.translatedContent,
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
            translation: translationRecord,
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
          error: { code: INTERNAL_ERROR_CODE, message: TRANSLATION_ERROR_MESSAGE },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.get("/:id/translate", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        { success: false, error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE } },
        HTTP_UNAUTHORIZED,
      );
    }

    const targetLanguageRaw = c.req.query("targetLanguage");
    if (!targetLanguageRaw) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: [{ field: "targetLanguage", message: "targetLanguageは必須です" }],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const langValidation = GenerateTranslationSchema.safeParse({
      targetLanguage: targetLanguageRaw,
    });
    if (!langValidation.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: langValidation.error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const targetLanguage = langValidation.data.targetLanguage;
    const articleId = c.req.param("id");
    const ownership = await ensureOwnedArticle(db, articleId, user.id);

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

    const translationResults = await db
      .select()
      .from(translations)
      .where(
        and(eq(translations.articleId, articleId), eq(translations.targetLanguage, targetLanguage)),
      );

    if (translationResults.length === 0) {
      return c.json(
        {
          success: false,
          error: { code: NOT_FOUND_ERROR_CODE, message: TRANSLATION_NOT_FOUND_MESSAGE },
        },
        HTTP_NOT_FOUND,
      );
    }

    return c.json({ success: true, data: translationResults[0] }, HTTP_OK);
  });

  return route;
}
