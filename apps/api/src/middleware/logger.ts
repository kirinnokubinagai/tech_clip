import type { MiddlewareHandler } from "hono";
import { createLogger } from "../lib/logger";

/** Hono コンテキストの Variables 型（user は optional） */
type LoggerVariables = {
  user?: { id: string };
  requestId?: string;
};

/**
 * リクエストロガーミドルウェアを生成する
 *
 * 各リクエストに対して以下を記録する:
 * - リクエストID（crypto.randomUUID() で生成）
 * - HTTPメソッド・パス
 * - レスポンスステータスコード
 * - レスポンス時間（ms）
 * - 認証済みの場合はユーザーID
 *
 * @returns Hono ミドルウェアハンドラー
 */
export function createRequestLoggerMiddleware(): MiddlewareHandler<{
  Variables: LoggerVariables;
}> {
  return async (c, next) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    c.set("requestId", requestId);

    await next();

    const responseTimeMs = Date.now() - startTime;
    const user = c.get("user");
    const logger = createLogger().withRequestId(requestId);

    const context: Record<string, unknown> = {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      responseTimeMs,
    };

    if (user?.id !== undefined) {
      context.userId = user.id;
    }

    logger.info("request", context);

    c.res.headers.set("X-Request-ID", requestId);
  };
}
