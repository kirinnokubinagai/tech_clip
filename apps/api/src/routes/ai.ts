import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { z } from "zod";

import type { Database } from "../db";
import { aiJobs, articles, translations } from "../db/schema";
import { DEFAULT_GEMMA_MODEL_TAG } from "../lib/ai-model";
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
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { createLogger } from "../lib/logger";
import type { TranslateArticleParams, TranslationResult } from "../services/translator";
import { SUPPORTED_LANGUAGES } from "../validators/ai";

const ARTICLE_NOT_FOUND_MESSAGE = "記事が見つかりません";
const TRANSLATION_NOT_FOUND_MESSAGE = "翻訳が見つかりません";
const TRANSLATION_ERROR_MESSAGE = "翻訳処理に失敗しました";
const NO_CONTENT_MESSAGE = "翻訳するコンテンツがありません";
const DEFAULT_TARGET_LANGUAGE = "en";

/** KV キャッシュ TTL（90日 = 秒単位） */
const KV_CACHE_TTL_SECONDS = 60 * 60 * 24 * 90;

/** KV キャッシュキーのプレフィックス */
const KV_KEY_PREFIX = "translate:v1";

const TranslateRequestSchema = z.object({
  targetLanguage: z.enum(SUPPORTED_LANGUAGES, {
    error: "targetLanguageはen、ja、zh、zh-CN、zh-TW、koで指定してください",
  }),
});

type TranslateFn = (params: TranslateArticleParams) => Promise<TranslationResult>;

/** 認証済みユーザーの型 */
type AuthUser = {
  id: string;
  [key: string]: unknown;
};

/** AI ルートオプション */
type AiRouteOptions = {
  db: Database;
  ai: Ai;
  modelTag?: string;
  /** env.CACHE KV namespace（テストでは省略可） */
  cache?: KVNamespace;
  translateFn: TranslateFn;
};

/**
 * KV キャッシュキーを生成する
 *
 * @param articleId - 記事ID
 * @param targetLanguage - 翻訳先言語
 * @returns KV キャッシュキー
 */
function buildKvKey(articleId: string, targetLanguage: string): string {
  return `${KV_KEY_PREFIX}:${articleId}:${targetLanguage}`;
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

/**
 * AI 翻訳ルートを生成する
 *
 * @param options - ルートオプション
 * @returns Hono ルートインスタンス
 */
export function createAiRoute(options: AiRouteOptions) {
  const { db, ai, modelTag, cache, translateFn } = options;
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
    const validation = TranslateRequestSchema.safeParse(body);
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

    const kvKey = buildKvKey(articleId, targetLanguage);
    if (cache) {
      const cached = await cache.get(kvKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Record<string, unknown>;
          return c.json({
            success: true,
            data: {
              status: "completed",
              progress: 100,
              jobId: null,
              translation: parsed,
            },
          });
        } catch {
          // キャッシュ不正の場合は無視して続行
        }
      }
    }

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

    const startedAt = new Date();
    const jobId = ulid();

    await db.insert(aiJobs).values({
      id: jobId,
      articleId,
      requestKey: kvKey,
      jobType: "translation",
      language: targetLanguage,
      status: "running",
      providerJobId: null,
      model: modelTag ?? DEFAULT_GEMMA_MODEL_TAG,
      errorMessage: null,
      createdAt: startedAt,
      updatedAt: startedAt,
      completedAt: null,
    });

    try {
      const result = await translateFn({
        ai,
        content: article.content,
        title: article.title,
        targetLanguage,
        modelTag,
      });

      const completedAt = new Date();

      const [translationRecord] = await db
        .insert(translations)
        .values({
          id: ulid(),
          articleId,
          targetLanguage,
          translatedTitle: result.translatedTitle,
          translatedContent: result.translatedContent,
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
          await cache.put(kvKey, JSON.stringify(translationRecord), {
            expirationTtl: KV_CACHE_TTL_SECONDS,
          });
        } catch (cacheError) {
          const cacheLogger = createLogger("translate-route");
          cacheLogger.warn("KV キャッシュ書き込みに失敗しました", {
            articleId,
            targetLanguage,
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
            translation: translationRecord,
          },
        },
        HTTP_OK,
      );
    } catch (error) {
      const logger = createLogger("translate-route");
      logger.error("翻訳生成に失敗しました", {
        articleId,
        targetLanguage,
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
                : TRANSLATION_ERROR_MESSAGE,
            updatedAt: failedAt,
          })
          .where(eq(aiJobs.id, jobId));
      } catch (dbError) {
        const dbLogger = createLogger("translate-route");
        dbLogger.error("aiJobs 失敗ステータス更新に失敗", {
          jobId,
          error:
            dbError instanceof Error ? { name: dbError.name, message: dbError.message } : dbError,
        });
      }

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

    if (job.status === "failed") {
      return c.json({
        success: true,
        data: {
          status: "failed",
          progress: 0,
          jobId: job.id,
          error: TRANSLATION_ERROR_MESSAGE,
        },
      });
    }

    return c.json({
      success: true,
      data: {
        status: job.status,
        progress: job.status === "running" ? 65 : 15,
        jobId: job.id,
      },
    });
  });

  route.get("/:id/translate", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        { success: false, error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE } },
        HTTP_UNAUTHORIZED,
      );
    }

    const rawTargetLanguage = c.req.query("targetLanguage");
    const targetLanguageParseResult = TranslateRequestSchema.safeParse({
      targetLanguage: rawTargetLanguage,
    });
    if (!targetLanguageParseResult.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: "targetLanguage が不正です",
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }
    const targetLanguage = targetLanguageParseResult.data.targetLanguage;
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
