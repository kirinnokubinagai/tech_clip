import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { articles, summaries, translations } from "../db/schema";
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
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { omitContent } from "../lib/response-utils";
import type { ParsedArticle } from "../services/article-parser";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** リソース未発見エラーメッセージ */
const NOT_FOUND_ERROR_MESSAGE = "記事が見つかりません";

/** URL最大文字数 */
const URL_MAX_LENGTH = 2048;

/** 字幕取得失敗を示すエラーコード（YouTubeパーサーが投げる） */
const NO_CAPTIONS_ERROR_CODE = "NO_CAPTIONS";

/** 字幕取得失敗時に返すユーザー向けメッセージ */
const NO_CAPTIONS_ERROR_MESSAGE =
  "この動画には字幕がないため、要約できません。別の動画をお試しください";

/** 記事保存リクエストのZodスキーマ */
const CreateArticleSchema = z.object({
  url: z
    .string({ error: "URLは必須です" })
    .min(1, "URLを入力してください")
    .max(URL_MAX_LENGTH, `URLは${URL_MAX_LENGTH}文字以内で入力してください`)
    .url("URLの形式が正しくありません")
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "URLはhttp://またはhttps://で始まる必要があります" },
    ),
});

/** 記事更新リクエストのZodスキーマ */
const UpdateArticleSchema = z
  .object({
    isRead: z.boolean({ error: "isReadはブール値で指定してください" }).optional(),
    isFavorite: z.boolean({ error: "isFavoriteはブール値で指定してください" }).optional(),
    isPublic: z.boolean({ error: "isPublicはブール値で指定してください" }).optional(),
    content: z.string({ error: "contentは文字列で指定してください" }).max(500_000).optional(),
  })
  .refine(
    (data) =>
      data.isRead !== undefined ||
      data.isFavorite !== undefined ||
      data.isPublic !== undefined ||
      data.content !== undefined,
    {
      message: "更新するフィールドを1つ以上指定してください",
    },
  );

/** 記事一覧クエリパラメータの型 */
export type ArticlesQueryParams = {
  userId: string;
  limit: number;
  cursor?: string;
  source?: string;
  isFavorite?: boolean;
  isRead?: boolean;
};

/** 記事一覧クエリ関数の型 */
export type ArticlesQueryFn = (
  params: ArticlesQueryParams,
) => Promise<Array<Record<string, unknown>>>;

/** parseArticle関数の型 */
type ParseArticleFn = (url: string) => Promise<ParsedArticle>;

/** createArticlesRouteのオプション */
type ArticlesRouteOptions = {
  db: Database;
  parseArticleFn: ParseArticleFn;
  queryFn: ArticlesQueryFn;
};

/**
 * 例外が YouTube の NO_CAPTIONS エラーかどうかを判定する
 *
 * @param error - catch で捕捉した値
 * @returns NO_CAPTIONS エラーの場合 true
 */
function isNoCaptionsError(error: unknown): boolean {
  return error instanceof Error && error.message === NO_CAPTIONS_ERROR_CODE;
}

/**
 * ブール値クエリパラメータをパースする
 *
 * @param value - クエリパラメータの文字列値
 * @returns パース結果。無効な値の場合はエラー文字列
 */
function parseBooleanParam(value: string | undefined): boolean | undefined | string {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return "invalid";
}

/**
 * 記事ルートを生成する
 *
 * GET /articles: 記事一覧（カーソルベースページネーション対応）
 * POST /parse: URL解析プレビュー（認証必須）
 * POST /: 記事保存（Zodバリデーション、重複チェック付き）
 * GET /:id: 記事詳細取得（認証必須、所有者チェック付き）
 * PATCH /:id: 記事更新（isRead/isFavorite/isPublic、認証必須、所有者チェック付き）
 * DELETE /:id: 記事削除（認証必須、所有者チェック付き）
 *
 * @param options - DB インスタンス、parseArticle 関数、記事一覧クエリ関数
 * @returns Hono ルーターインスタンス
 */
export function createArticlesRoute(options: ArticlesRouteOptions) {
  const { db, parseArticleFn, queryFn } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.get("/", async (c) => {
    const user = c.get("user");
    if (!user) {
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

    const limitStr = c.req.query("limit");
    const cursor = c.req.query("cursor");
    const source = c.req.query("source");
    const isFavoriteStr = c.req.query("isFavorite");
    const isReadStr = c.req.query("isRead");

    let limit = DEFAULT_LIMIT;
    if (limitStr !== undefined) {
      const parsed = Number(limitStr);
      if (Number.isNaN(parsed) || !Number.isInteger(parsed)) {
        return c.json(
          {
            success: false,
            error: {
              code: VALIDATION_ERROR_CODE,
              message: VALIDATION_ERROR_MESSAGE,
              details: [{ field: "limit", message: "limitは整数で指定してください" }],
            },
          },
          HTTP_UNPROCESSABLE_ENTITY,
        );
      }
      if (parsed < MIN_LIMIT || parsed > MAX_LIMIT) {
        return c.json(
          {
            success: false,
            error: {
              code: VALIDATION_ERROR_CODE,
              message: VALIDATION_ERROR_MESSAGE,
              details: [
                {
                  field: "limit",
                  message: `limitは${MIN_LIMIT}以上${MAX_LIMIT}以下で指定してください`,
                },
              ],
            },
          },
          HTTP_UNPROCESSABLE_ENTITY,
        );
      }
      limit = parsed;
    }

    const isFavorite = parseBooleanParam(isFavoriteStr);
    if (isFavorite === "invalid") {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: [
              {
                field: "isFavorite",
                message: "isFavoriteはtrueまたはfalseで指定してください",
              },
            ],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const isRead = parseBooleanParam(isReadStr);
    if (isRead === "invalid") {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: [
              {
                field: "isRead",
                message: "isReadはtrueまたはfalseで指定してください",
              },
            ],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const fetchedArticles = await queryFn({
      userId: user.id as string,
      limit: limit + 1,
      cursor: cursor || undefined,
      source: source || undefined,
      isFavorite: isFavorite as boolean | undefined,
      isRead: isRead as boolean | undefined,
    });

    const hasNext = fetchedArticles.length > limit;
    const sliced = hasNext ? fetchedArticles.slice(0, limit) : fetchedArticles;
    const data = sliced.map(omitContent);
    const nextCursor = hasNext ? (data[data.length - 1].id as string) : null;

    return c.json({
      success: true,
      data,
      meta: {
        nextCursor,
        hasNext,
      },
    });
  });

  route.post("/parse", async (c) => {
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
    const validation = CreateArticleSchema.safeParse(body);

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

    const { url } = validation.data;

    try {
      const parsed = await parseArticleFn(url);

      return c.json(
        {
          success: true,
          data: {
            title: parsed.title,
            excerpt: parsed.excerpt,
            author: parsed.author,
            source: parsed.source,
            thumbnailUrl: parsed.thumbnailUrl,
            readingTimeMinutes: parsed.readingTimeMinutes,
            publishedAt: parsed.publishedAt,
          },
        },
        HTTP_OK,
      );
    } catch (error) {
      if (isNoCaptionsError(error)) {
        return c.json(
          {
            success: false,
            error: {
              code: NO_CAPTIONS_ERROR_CODE,
              message: NO_CAPTIONS_ERROR_MESSAGE,
            },
          },
          HTTP_UNPROCESSABLE_ENTITY,
        );
      }
      console.error(
        "parseArticle failed:",
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : "",
      );
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "記事の解析に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.post("/:id/clone", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: { code: AUTH_ERROR_CODE, message: AUTH_ERROR_MESSAGE },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const userId = user.id as string;
    const sourceId = c.req.param("id");

    const [source] = await db.select().from(articles).where(eq(articles.id, sourceId));
    if (!source) {
      return c.json(
        {
          success: false,
          error: { code: NOT_FOUND_ERROR_CODE, message: NOT_FOUND_ERROR_MESSAGE },
        },
        HTTP_NOT_FOUND,
      );
    }

    if (source.userId !== userId && !source.isPublic) {
      return c.json(
        {
          success: false,
          error: { code: FORBIDDEN_ERROR_CODE, message: FORBIDDEN_ERROR_MESSAGE },
        },
        HTTP_FORBIDDEN,
      );
    }

    const existing = await db
      .select()
      .from(articles)
      .where(and(eq(articles.userId, userId), eq(articles.url, source.url)));
    if (existing.length > 0) {
      return c.json(
        {
          success: false,
          error: { code: "DUPLICATE", message: "この記事はすでに保存されています" },
        },
        HTTP_CONFLICT,
      );
    }

    const now = new Date();
    const id = crypto.randomUUID();
    const [inserted] = await db
      .insert(articles)
      .values({
        id,
        userId,
        url: source.url,
        source: source.source,
        title: source.title,
        author: source.author,
        content: source.content,
        excerpt: source.excerpt,
        thumbnailUrl: source.thumbnailUrl,
        readingTimeMinutes: source.readingTimeMinutes,
        isRead: false,
        isFavorite: false,
        isPublic: false,
        publishedAt: source.publishedAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ success: true, data: inserted }, HTTP_CREATED);
  });

  route.post("/", async (c) => {
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

    const userId = user.id as string;

    const body = await c.req.json().catch(() => ({}));
    const validation = CreateArticleSchema.safeParse(body);

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

    const { url } = validation.data;

    const existing = await db
      .select()
      .from(articles)
      .where(and(eq(articles.userId, userId), eq(articles.url, url)));

    if (existing.length > 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "DUPLICATE",
            message: "この記事はすでに保存されています",
          },
        },
        HTTP_CONFLICT,
      );
    }

    try {
      const parsed = await parseArticleFn(url);

      const now = new Date();
      const id = crypto.randomUUID();

      const publishedAt = parsed.publishedAt ? new Date(parsed.publishedAt) : null;

      const [inserted] = await db
        .insert(articles)
        .values({
          id,
          userId,
          url,
          source: parsed.source,
          title: parsed.title,
          author: parsed.author ?? null,
          content: parsed.content ?? null,
          excerpt: parsed.excerpt ?? null,
          thumbnailUrl: parsed.thumbnailUrl ?? null,
          readingTimeMinutes: parsed.readingTimeMinutes ?? null,
          isRead: false,
          isFavorite: false,
          isPublic: false,
          publishedAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return c.json(
        {
          success: true,
          data: inserted,
        },
        HTTP_CREATED,
      );
    } catch (error) {
      if (isNoCaptionsError(error)) {
        return c.json(
          {
            success: false,
            error: {
              code: NO_CAPTIONS_ERROR_CODE,
              message: NO_CAPTIONS_ERROR_MESSAGE,
            },
          },
          HTTP_UNPROCESSABLE_ENTITY,
        );
      }
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "記事の取得・保存に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.get("/:id", async (c) => {
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

    const results = await db.select().from(articles).where(eq(articles.id, articleId));

    if (results.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: NOT_FOUND_ERROR_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const article = results[0];

    if (article.userId !== (user.id as string) && !article.isPublic) {
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

    const [summary] = await db
      .select()
      .from(summaries)
      .where(and(eq(summaries.articleId, articleId), eq(summaries.language, "ja")));
    const [translation] = await db
      .select()
      .from(translations)
      .where(and(eq(translations.articleId, articleId), eq(translations.targetLanguage, "en")));

    return c.json(
      {
        success: true,
        data: {
          ...article,
          summary: summary?.summary ?? null,
          translation: translation?.translatedContent ?? null,
        },
      },
      HTTP_OK,
    );
  });

  route.patch("/:id", async (c) => {
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
    const validation = UpdateArticleSchema.safeParse(body);

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

    const results = await db.select().from(articles).where(eq(articles.id, articleId));

    if (results.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: NOT_FOUND_ERROR_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const article = results[0];

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

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validation.data.isRead !== undefined) {
      updateData.isRead = validation.data.isRead;
    }
    if (validation.data.isFavorite !== undefined) {
      updateData.isFavorite = validation.data.isFavorite;
    }
    if (validation.data.isPublic !== undefined) {
      updateData.isPublic = validation.data.isPublic;
    }

    await db.update(articles).set(updateData).where(eq(articles.id, articleId));

    return c.json(
      {
        success: true,
        data: { ...article, ...updateData },
      },
      HTTP_OK,
    );
  });

  route.delete("/:id", async (c) => {
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

    const results = await db.select().from(articles).where(eq(articles.id, articleId));

    if (results.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: NOT_FOUND_ERROR_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const article = results[0];

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

    await db.delete(articles).where(eq(articles.id, articleId));

    return c.body(null, HTTP_NO_CONTENT);
  });

  return route;
}
