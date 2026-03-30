import { Hono } from "hono";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** 検索キーワード最大文字数 */
const QUERY_MAX_LENGTH = 200;

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

/** 検索クエリパラメータの型 */
export type SearchQueryParams = {
  userId: string;
  query: string;
  limit: number;
  cursor?: string;
};

/** 検索クエリ関数の型 */
export type SearchQueryFn = (params: SearchQueryParams) => Promise<Array<Record<string, unknown>>>;

/** createSearchRouteのオプション */
type SearchRouteOptions = {
  searchQueryFn: SearchQueryFn;
};

/**
 * LIKE演算子のワイルドカード文字をエスケープする
 *
 * @param query - エスケープ対象の検索キーワード
 * @returns ワイルドカード文字（%、_、\）をエスケープした文字列
 */
export function escapeLikeWildcards(query: string): string {
  return query.replace(/[%_\\]/g, "\\$&");
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
 * 全文検索ルートを生成する
 *
 * GET /search: title/content/excerptをLIKE検索（認証必須、カーソルベースページネーション）
 *
 * @param options - 検索クエリ関数
 * @returns Hono ルーターインスタンス
 */
export function createSearchRoute(options: SearchRouteOptions) {
  const { searchQueryFn } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.get("/search", async (c) => {
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

    const q = c.req.query("q");
    if (!q || q.trim().length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: [{ field: "q", message: "検索キーワードを入力してください" }],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    if (q.length > QUERY_MAX_LENGTH) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: [
              {
                field: "q",
                message: `検索キーワードは${QUERY_MAX_LENGTH}文字以内で入力してください`,
              },
            ],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

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

    const results = await searchQueryFn({
      userId: user.id as string,
      query: q,
      limit: limit + 1,
      cursor: cursor || undefined,
    });

    const hasNext = results.length > limit;
    const sliced = hasNext ? results.slice(0, limit) : results;
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
