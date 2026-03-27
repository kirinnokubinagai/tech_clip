import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { notifications } from "../db/schema";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** HTTP 201 Created ステータスコード */
const HTTP_CREATED = 201;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** 未認証エラーコード */
const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

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

  route.get("/notifications", async (c) => {
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
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      const [inserted] = await db
        .insert(notifications)
        .values({
          id,
          userId,
          type: "push_token",
          title: "プッシュトークン登録",
          body: token,
          data: JSON.stringify({ token, platform }),
          isRead: false,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [notifications.id],
          set: {
            body: token,
            data: JSON.stringify({ token, platform }),
          },
        })
        .returning();

      return c.json(
        {
          success: true,
          data: {
            ...inserted,
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

  return route;
}
