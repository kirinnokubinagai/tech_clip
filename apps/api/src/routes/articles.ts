import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { articles } from "../db/schema";
import type { ParsedArticle } from "../services/article-parser";

/** HTTP 201 Created ステータスコード */
const HTTP_CREATED = 201;

/** HTTP 409 Conflict ステータスコード */
const HTTP_CONFLICT = 409;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

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

/** parseArticle関数の型 */
type ParseArticleFn = (url: string) => Promise<ParsedArticle>;

/** createArticlesRouteのオプション */
type ArticlesRouteOptions = {
  db: Database;
  parseArticleFn: ParseArticleFn;
};

/**
 * 記事ルートを生成する
 *
 * @param options - DB インスタンスと parseArticle 関数
 * @returns Hono ルーターインスタンス
 */
export function createArticlesRoute(options: ArticlesRouteOptions) {
  const { db, parseArticleFn } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: "AUTH_REQUIRED",
            message: "ログインが必要です",
          },
        },
        401,
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
            code: "VALIDATION_FAILED",
            message: "入力内容を確認してください",
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
