import { Hono } from "hono";

import {
  NOT_FOUND_ERROR_CODE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import { HTTP_NOT_FOUND, HTTP_UNPROCESSABLE_ENTITY } from "../lib/http-status";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** ユーザー未発見エラーメッセージ */
const USER_NOT_FOUND_MESSAGE = "ユーザーが見つかりません";

/** 公開記事一覧クエリパラメータの型 */
export type PublicArticlesQueryParams = {
  userId: string;
  limit: number;
  cursor?: string;
};

/** 公開記事一覧クエリ関数の型 */
export type PublicArticlesQueryFn = (
  params: PublicArticlesQueryParams,
) => Promise<Array<Record<string, unknown>>>;

/** ユーザー存在確認関数の型 */
export type UserExistsFn = (userId: string) => Promise<boolean>;

/** createPublicArticlesRouteのオプション */
type PublicArticlesRouteOptions = {
  queryFn: PublicArticlesQueryFn;
  userExistsFn: UserExistsFn;
};

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
 * 公開記事一覧ルートを生成する
 *
 * GET /:id/articles: 指定ユーザーの公開記事一覧（認証不要、カーソルベースページネーション対応）
 *
 * @param options - クエリ関数、ユーザー存在確認関数
 * @returns Hono ルーターインスタンス
 */
export function createPublicArticlesRoute(options: PublicArticlesRouteOptions) {
  const { queryFn, userExistsFn } = options;
  const route = new Hono();

  route.get("/:id/articles", async (c) => {
    const userId = c.req.param("id");

    const limitStr = c.req.query("limit");
    const cursor = c.req.query("cursor");

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

    const isUserExists = await userExistsFn(userId);
    if (!isUserExists) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: USER_NOT_FOUND_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const fetchedArticles = await queryFn({
      userId,
      limit: limit + 1,
      cursor: cursor || undefined,
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

  return route;
}
