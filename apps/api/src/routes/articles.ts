import { Hono } from "hono";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** 未認証エラーコード */
const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

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
 * 記事一覧ルートを生成する
 *
 * 認証必須。カーソルベースページネーション対応。
 * source, isFavorite, isRead でフィルタリング可能。
 *
 * @param queryFn - 記事一覧クエリ関数（DI用）
 * @returns Hono ルーター
 */
export function createArticlesRoute(queryFn: ArticlesQueryFn) {
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

    const articles = await queryFn({
      userId: user.id as string,
      limit: limit + 1,
      cursor: cursor || undefined,
      source: source || undefined,
      isFavorite: isFavorite as boolean | undefined,
      isRead: isRead as boolean | undefined,
    });

    const hasNext = articles.length > limit;
    const sliced = hasNext ? articles.slice(0, limit) : articles;
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
