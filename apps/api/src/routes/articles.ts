import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { articles } from "../db/schema";
import type { ParsedArticle } from "../services/article-parser";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** HTTP 201 Created ステータスコード */
const HTTP_CREATED = 201;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 409 Conflict ステータスコード */
const HTTP_CONFLICT = 409;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** 未認証エラーコード */
const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

/** URL最大文字数 */
const URL_MAX_LENGTH = 2048;

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
 * レスポンスからcontentフィールドを除外する
 *
 * @param article - 記事データ
 * @returns contentを除いた記事データ
 */
function omitContent(article: Record<string, unknown>): Record<string, unknown> {
  const { content: _, ...rest } = article;
  return rest;
}

/**
 * 記事ルートを生成する
 *
 * GET /articles: 記事一覧（カーソルベースページネーション対応）
 * POST /: 記事保存（Zodバリデーション、重複チェック付き）
 *
 * @param options - DB インスタンス、parseArticle 関数、記事一覧クエリ関数
 * @returns Hono ルーターインスタンス
 */
export function createArticlesRoute(options: ArticlesRouteOptions) {
  const { db, parseArticleFn, queryFn } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.get("/articles", async (c) => {
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
    } catch {
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

  return route;
}
