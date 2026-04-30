import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "../db";
import { articles } from "../db/schema";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  FORBIDDEN_ERROR_CODE,
  FORBIDDEN_ERROR_MESSAGE,
  NOT_FOUND_ERROR_CODE,
} from "../lib/error-codes";
import { HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_OK, HTTP_UNAUTHORIZED } from "../lib/http-status";

/** リソース未発見エラーメッセージ */
const NOT_FOUND_ERROR_MESSAGE = "記事が見つかりません";

/** createFavoriteRouteのオプション */
type FavoriteRouteOptions = {
  db: Database;
};

/**
 * お気に入りトグルルートを生成する
 *
 * POST /:id/favorite: 記事のisFavoriteをトグル（認証必須、所有者チェック付き）
 *
 * @param options - DB インスタンス
 * @returns Hono ルーターインスタンス
 */
export function createFavoriteRoute(options: FavoriteRouteOptions) {
  const { db } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/:id/favorite", async (c) => {
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

    const newIsFavorite = !article.isFavorite;

    await db
      .update(articles)
      .set({ isFavorite: newIsFavorite, updatedAt: new Date() })
      .where(eq(articles.id, articleId));

    return c.json(
      {
        success: true,
        data: {
          id: article.id,
          isFavorite: newIsFavorite,
        },
      },
      HTTP_OK,
    );
  });

  return route;
}
