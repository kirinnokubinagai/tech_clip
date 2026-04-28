import { Hono } from "hono";

import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import { HTTP_UNAUTHORIZED, HTTP_UNPROCESSABLE_ENTITY } from "../lib/http-status";
import { omitContent } from "../lib/response-utils";

/**
 * 検索クエリをFTS5のMATCH式に変換する（trigram tokenizer対応）
 *
 * trigram tokenizer は3文字N-gramでインデックスを構築するため、
 * 3文字未満のトークンはtrigramを生成できず除外する。
 * trigramは部分一致を内包するためワイルドカード（*）は不要。
 * ダブルクォートはダブルクォート2連でエスケープする。
 *
 * @param query - 検索キーワード（スペース区切り複数語可）
 * @returns FTS5 MATCH 式文字列。有効なトークンが空の場合はnull
 */
export function buildFtsMatchExpression(query: string): string | null {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 3); // trigram には最低3文字必要

  if (tokens.length === 0) {
    return null;
  }

  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(" AND ");
}

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** 検索キーワード最大文字数 */
const QUERY_MAX_LENGTH = 200;

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
 * 全文検索ルートを生成する
 *
 * GET /search: title/content/excerptをFTS5 MATCHで全文検索（認証必須、カーソルベースページネーション）
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
