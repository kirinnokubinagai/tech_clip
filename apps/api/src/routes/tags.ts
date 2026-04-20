import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { articles, articleTags, tags } from "../db/schema";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import {
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";

/** タグ名最大文字数 */
const TAG_NAME_MAX_LENGTH = 50;

/** タグ作成リクエストのZodスキーマ */
const CreateTagSchema = z.object({
  name: z
    .string({ error: "タグ名は必須です" })
    .min(1, "タグ名を入力してください")
    .max(TAG_NAME_MAX_LENGTH, `タグ名は${TAG_NAME_MAX_LENGTH}文字以内で入力してください`)
    .trim(),
});

/** 記事タグ更新リクエストのZodスキーマ */
const UpdateArticleTagsSchema = z.object({
  tagIds: z.array(z.string(), { error: "tagIdsは配列で指定してください" }),
});

/** createTagsRouteのオプション */
type TagsRouteOptions = {
  db: Database;
};

/**
 * タグルートを生成する
 *
 * POST /tags: タグ作成（Zodバリデーション、重複チェック付き）
 * GET /tags: ユーザーのタグ一覧取得
 * DELETE /tags/:id: タグ削除（所有者チェック付き）
 * PUT /articles/:id/tags: 記事へのタグ付け（置換方式）
 *
 * @param options - DB インスタンス
 * @returns Hono ルーターインスタンス
 */
export function createTagsRoute(options: TagsRouteOptions) {
  const { db } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

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
    const validation = CreateTagSchema.safeParse(body);

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

    const { name } = validation.data;

    const existing = await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, name)));

    if (existing.length > 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "DUPLICATE",
            message: "このタグはすでに登録されています",
          },
        },
        HTTP_CONFLICT,
      );
    }

    const now = new Date();
    const id = crypto.randomUUID();

    const [inserted] = await db
      .insert(tags)
      .values({
        id,
        userId,
        name,
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
  });

  route.get("/", async (c) => {
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

    const userTags = await db.select().from(tags).where(eq(tags.userId, userId));

    return c.json({
      success: true,
      data: userTags,
    });
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

    const userId = user.id as string;
    const tagId = c.req.param("id");

    const existing = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));

    if (existing.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "タグが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    await db.delete(tags).where(eq(tags.id, tagId));

    return c.body(null, HTTP_NO_CONTENT);
  });

  return route;
}
/**
 * 記事タグ更新ルートを生成する
 *
 * PUT /:id/tags: 記事へのタグ付け（置換方式）
 *
 * @param options - DB インスタンス
 * @returns Hono ルーターインスタンス
 */
export function createArticleTagsRoute(options: TagsRouteOptions) {
  const { db } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.put("/:id/tags", async (c) => {
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
    const articleId = c.req.param("id");

    const body = await c.req.json().catch(() => ({}));
    const validation = UpdateArticleTagsSchema.safeParse(body);

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

    const { tagIds } = validation.data;

    const existingArticle = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.userId, userId)));

    if (existingArticle.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "記事が見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    if (tagIds.length > 0) {
      const existingTags = await db
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));

      const validTagIds = existingTags.map((t) => t.id);

      await db.delete(articleTags).where(eq(articleTags.articleId, articleId));

      if (validTagIds.length > 0) {
        await db
          .insert(articleTags)
          .values(validTagIds.map((tagId) => ({ articleId, tagId })))
          .onConflictDoNothing();
      }

      return c.json({
        success: true,
        data: {
          articleId,
          tagIds: validTagIds,
        },
      });
    }

    await db.delete(articleTags).where(eq(articleTags.articleId, articleId));

    return c.json({
      success: true,
      data: {
        articleId,
        tagIds: [],
      },
    });
  });

  return route;
}
