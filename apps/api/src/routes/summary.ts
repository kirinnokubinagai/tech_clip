import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { articles, summaries } from "../db/schema";
import type { RunPodConfig, SummaryResult } from "../services/summary";

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

/** 要約未発見エラーメッセージ */
const SUMMARY_NOT_FOUND_MESSAGE = "要約が見つかりません";

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

/** サーバーエラーコード */
const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

/** 要約生成エラーメッセージ */
const SUMMARY_GENERATION_ERROR_MESSAGE = "要約の生成に失敗しました";

/** コンテンツなしエラーメッセージ */
const NO_CONTENT_ERROR_MESSAGE = "記事のコンテンツがありません";

/** サポートされる言語 */
const SUPPORTED_LANGUAGES = ["ja", "en", "zh", "ko"] as const;

/** デフォルト言語 */
const DEFAULT_LANGUAGE = "ja";

/** 要約生成リクエストのZodスキーマ */
const CreateSummarySchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, {
    error: `languageは${SUPPORTED_LANGUAGES.join(", ")}のいずれかで指定してください`,
  }),
});

/** summarizeArticle関数の型 */
type SummarizeFn = (params: {
  content: string;
  language: string;
  config: RunPodConfig;
}) => Promise<SummaryResult>;

/** createSummaryRouteのオプション */
type SummaryRouteOptions = {
  db: Database;
  summarizeFn: SummarizeFn;
  runpodConfig: RunPodConfig;
};

/**
 * 要約ルートを生成する
 *
 * POST /articles/:id/summary: 要約生成（キャッシュ存在時はそのまま返却）
 * GET /articles/:id/summary: キャッシュ済み要約取得
 *
 * @param options - DB インスタンス、要約関数、RunPod設定
 * @returns Hono ルーターインスタンス
 */
export function createSummaryRoute(options: SummaryRouteOptions) {
  const { db, summarizeFn, runpodConfig } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/articles/:id/summary", async (c) => {
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

    const existingSummaries = await db
      .select()
      .from(summaries)
      .where(and(eq(summaries.articleId, articleId), eq(summaries.language, language)));

    if (existingSummaries.length > 0) {
      return c.json(
        {
          success: true,
          data: existingSummaries[0],
        },
        HTTP_OK,
      );
    }

    if (!article.content) {
      return c.json(
        {
          success: false,
          error: {
            code: INTERNAL_ERROR_CODE,
            message: NO_CONTENT_ERROR_MESSAGE,
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const result = await summarizeFn({
        content: article.content,
        language,
        config: runpodConfig,
      });

      const now = new Date();
      const id = crypto.randomUUID();

      const [inserted] = await db
        .insert(summaries)
        .values({
          id,
          articleId,
          language,
          summary: result.summary,
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
            message: SUMMARY_GENERATION_ERROR_MESSAGE,
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.get("/articles/:id/summary", async (c) => {
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

    const articleId = c.req.param("id");
    const language = c.req.query("language") ?? DEFAULT_LANGUAGE;

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

    const summaryResults = await db
      .select()
      .from(summaries)
      .where(and(eq(summaries.articleId, articleId), eq(summaries.language, language)));

    if (summaryResults.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: SUMMARY_NOT_FOUND_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    return c.json(
      {
        success: true,
        data: summaryResults[0],
      },
      HTTP_OK,
    );
  });

  return route;
}
