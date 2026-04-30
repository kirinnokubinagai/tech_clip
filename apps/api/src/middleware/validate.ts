import type { Context, MiddlewareHandler } from "hono";
import type { z } from "zod";

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

/**
 * Zodスキーマを使ってJSONボディをバリデーションするHonoミドルウェアを生成する
 *
 * @param schema - Zodスキーマ
 * @returns Honoミドルウェアハンドラー
 */
export function validateJson<S extends z.ZodTypeAny>(schema: S): MiddlewareHandler {
  return async (c: Context, next) => {
    const body = await c.req.json().catch(() => ({}));
    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: result.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    c.set("validatedBody", result.data);
    await next();
  };
}

/**
 * Zodスキーマを使ってクエリパラメータをバリデーションするHonoミドルウェアを生成する
 *
 * @param schema - Zodスキーマ
 * @returns Honoミドルウェアハンドラー
 */
export function validateQuery<S extends z.ZodTypeAny>(schema: S): MiddlewareHandler {
  return async (c: Context, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: result.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    c.set("validatedQuery", result.data);
    await next();
  };
}
