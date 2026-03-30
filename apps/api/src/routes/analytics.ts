import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { analyticsEvents } from "../db/schema/analytics-events";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import { HTTP_CREATED, HTTP_UNAUTHORIZED, HTTP_UNPROCESSABLE_ENTITY } from "../lib/http-status";

/** イベント名の最大文字数 */
const EVENT_NAME_MAX_LENGTH = 255;

/** アナリティクスイベント送信リクエストのZodスキーマ */
const TrackEventSchema = z.object({
  event: z
    .string({ error: "イベント名は必須です" })
    .min(1, "イベント名を入力してください")
    .max(EVENT_NAME_MAX_LENGTH, `イベント名は${EVENT_NAME_MAX_LENGTH}文字以内で入力してください`),
  properties: z.record(z.string(), z.unknown()).optional().default({}),
});

/** createAnalyticsRouteのオプション */
type AnalyticsRouteOptions = {
  db: Database;
};

/**
 * アナリティクスルートを生成する
 *
 * POST /events: アナリティクスイベントを受信してDBに保存（認証必須）
 *
 * @param options - DB インスタンス
 * @returns Hono ルーターインスタンス
 */
export function createAnalyticsRoute(options: AnalyticsRouteOptions) {
  const { db } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/events", async (c) => {
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

    const body = await c.req.json().catch(() => ({}));
    const validation = TrackEventSchema.safeParse(body);

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

    const { event, properties } = validation.data;
    const userId = user.id as string;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const [inserted] = await db
      .insert(analyticsEvents)
      .values({
        id,
        userId,
        event,
        properties: JSON.stringify(properties),
        createdAt,
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

  return route;
}
