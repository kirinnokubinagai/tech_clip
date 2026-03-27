import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "../db";
import { articles } from "../db/schema";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 403 Forbidden ステータスコード */
const HTTP_FORBIDDEN = 403;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

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
