import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { notifications, users } from "../db/schema";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import {
  HTTP_CREATED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** プッシュトークン最大文字数 */
const TOKEN_MAX_LENGTH = 512;

/** プッシュトークン登録リクエストのZodスキーマ */
const RegisterPushTokenSchema = z.object({
  token: z
    .string({ error: "トークンは必須です" })
    .min(1, "トークンを入力してください")
    .max(TOKEN_MAX_LENGTH, `トークンは${TOKEN_MAX_LENGTH}文字以内で入力してください`),
  platform: z.enum(["ios", "android"], {
    error: "platformはiosまたはandroidで指定してください",
  }),
});

/** 通知一覧クエリパラメータの型 */
export type NotificationsQueryParams = {
  userId: string;
  limit: number;
  cursor?: string;
};

/** 通知一覧クエリ関数の型 */
export type NotificationsQueryFn = (
  params: NotificationsQueryParams,
) => Promise<Array<Record<string, unknown>>>;

/** createNotificationsRouteのオプション */
type NotificationsRouteOptions = {
  db: Database;
  queryFn: NotificationsQueryFn;
};

/**
 * 通知ルートを生成する
 *
 * GET /notifications: 通知一覧（カーソルベースページネーション対応）
 * POST /register: プッシュトークン登録
 * PATCH /:id/read: 通知既読化
 *
 * @param options - DB インスタンス、通知一覧クエリ関数
 * @returns Hono ルーターインスタンス
 */
export function createNotificationsRoute(options: NotificationsRouteOptions) {
  const { db, queryFn } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.get("/", async (c) => {
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

    const fetchedNotifications = await queryFn({
      userId: user.id as string,
      limit: limit + 1,
      cursor: cursor || undefined,
    });

    const hasNext = fetchedNotifications.length > limit;
    const sliced = hasNext ? fetchedNotifications.slice(0, limit) : fetchedNotifications;
    const nextCursor = hasNext ? (sliced[sliced.length - 1].id as string) : null;

    return c.json({
      success: true,
      data: sliced,
      meta: {
        nextCursor,
        hasNext,
      },
    });
  });

  route.post("/register", async (c) => {
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
    const validation = RegisterPushTokenSchema.safeParse(body);

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

    const { token, platform } = validation.data;

    try {
      await db.update(users).set({ pushToken: token }).where(eq(users.id, userId));

      return c.json(
        {
          success: true,
          data: {
            token,
            platform,
          },
        },
        HTTP_CREATED,
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "トークンの登録に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.patch("/:id/read", async (c) => {
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
    const notificationId = c.req.param("id");

    const existing = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));

    if (existing.length === 0 || existing[0].userId !== userId) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "通知が見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    try {
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId))
        .returning();

      return c.json({
        success: true,
        data: updated,
      });
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "通知の更新に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  route.get("/unread-count", async (c) => {
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

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    const count = Number(result[0]?.count ?? 0);

    return c.json({
      success: true,
      data: { count },
    });
  });

  route.patch("/read-all", async (c) => {
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

    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

      return c.json({
        success: true,
        data: null,
      });
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "通知の更新に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  return route;
}
