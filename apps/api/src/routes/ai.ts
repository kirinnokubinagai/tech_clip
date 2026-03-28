import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { articles, translations } from "../db/schema";
import type { TranslateOptions, TranslationResult } from "../services/translator";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 201 Created ステータスコード */
const HTTP_CREATED = 201;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 403 Forbidden ステータスコード */
const HTTP_FORBIDDEN = 403;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** 未認証エラーコード */
const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** 権限エラーコード */
const FORBIDDEN_ERROR_CODE = "FORBIDDEN";

/** 権限エラーメッセージ */
const FORBIDDEN_ERROR_MESSAGE = "この操作を実行する権限がありません";

/** リソース未発見エラーコード */
const NOT_FOUND_ERROR_CODE = "NOT_FOUND";

/** 記事未発見エラーメッセージ */
const ARTICLE_NOT_FOUND_MESSAGE = "記事が見つかりません";

/** 翻訳未発見エラーメッセージ */
const TRANSLATION_NOT_FOUND_MESSAGE = "翻訳が見つかりません";

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

/** 内部エラーコード */
const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

/** 翻訳エラーメッセージ */
const TRANSLATION_ERROR_MESSAGE = "翻訳処理に失敗しました";

/** コンテンツ不足エラーメッセージ */
const NO_CONTENT_MESSAGE = "翻訳するコンテンツがありません";

/** サポートされる言語 */
const SUPPORTED_LANGUAGES = ["en", "ja"] as const;

/** 翻訳リクエストのZodスキーマ */
const TranslateRequestSchema = z.object({
  targetLanguage: z.enum(SUPPORTED_LANGUAGES, {
    error: "targetLanguageはenまたはjaで指定してください",
  }),
});

/** translateArticle関数の型 */
type TranslateArticleFn = (options: TranslateOptions) => Promise<TranslationResult>;

/** RunPod設定 */
type RunpodConfig = {
  apiKey: string;
  endpointId: string;
};

/** createAiRouteのオプション */
type AiRouteOptions = {
  db: Database;
  translateArticleFn: TranslateArticleFn;
  runpodConfig: RunpodConfig;
};

/**
 * AI翻訳ルートを生成する
 *
 * POST /:id/translate: 記事を翻訳（キャッシュあり）
 * GET /:id/translate: 翻訳結果を取得
 *
 * @param options - DB インスタンス、翻訳関数
 * @returns Hono ルーターインスタンス
 */
export function createAiRoute(options: AiRouteOptions) {
  const { db, translateArticleFn, runpodConfig } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/:id/translate", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
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

    const articleResults = await db.select().from(articles).where(eq(articles.id, articleId));

    if (articleResults.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: ARTICLE_NOT_FOUND_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const article = articleResults[0];

    if (article.userId !== (user.id as string)) {
      return c.json(
        {
          success: false,
          error: {
            code: FORBIDDEN_ERROR_CODE,
            message: FORBIDDEN_ERROR_MESSAGE,
          },
        },
        HTTP_FORBIDDEN,
      );
    }

    const existingTranslations = await db
      .select()
      .from(translations)
      .where(
        and(eq(translations.articleId, articleId), eq(translations.targetLanguage, targetLanguage)),
      );

    if (existingTranslations.length > 0) {
      return c.json(
        {
          success: true,
          data: existingTranslations[0],
        },
        HTTP_OK,
      );
    }

    if (!article.content) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: NO_CONTENT_MESSAGE,
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    try {
      const result = await translateArticleFn({
        title: article.title,
        content: article.content,
        targetLanguage,
        runpodApiKey: runpodConfig.apiKey,
        runpodEndpointId: runpodConfig.endpointId,
      });

      const now = new Date();
      const id = crypto.randomUUID();

      const [inserted] = await db
        .insert(translations)
        .values({
          id,
          articleId,
          targetLanguage,
          translatedTitle: result.translatedTitle,
          translatedContent: result.translatedContent,
          model: result.model,
          createdAt: now,
        })
        .returning();

      return c.json(
        {
          success: true,
          data: inserted,
        },
        HTTP_CREATED,
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: INTERNAL_ERROR_CODE,
            message: TRANSLATION_ERROR_MESSAGE,
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.get("/:id/translate", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const targetLanguage = c.req.query("targetLanguage");

    if (!targetLanguage) {
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

    const articleId = c.req.param("id");

    const articleResults = await db.select().from(articles).where(eq(articles.id, articleId));

    if (articleResults.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: ARTICLE_NOT_FOUND_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const article = articleResults[0];

    if (article.userId !== (user.id as string)) {
      return c.json(
        {
          success: false,
          error: {
            code: FORBIDDEN_ERROR_CODE,
            message: FORBIDDEN_ERROR_MESSAGE,
          },
        },
        HTTP_FORBIDDEN,
      );
    }

    const whereCondition = targetLanguage
      ? and(eq(translations.articleId, articleId), eq(translations.targetLanguage, targetLanguage))
      : eq(translations.articleId, articleId);

    const translationResults = await db.select().from(translations).where(whereCondition);

    if (translationResults.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: TRANSLATION_NOT_FOUND_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    return c.json(
      {
        success: true,
        data: translationResults[0],
      },
      HTTP_OK,
    );
  });

  return route;
}
