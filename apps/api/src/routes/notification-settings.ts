import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import type { NotificationSettings } from "../db/schema";
import { notificationSettings } from "../db/schema";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import {
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { createLogger } from "../lib/logger";

const logger = createLogger("notification-settings");

/** レスポンスから除外するフィールド */
const OMIT_FIELDS = ["userId"] as const;

/** 通知設定更新スキーマ */
const UpdateNotificationSettingsSchema = z
  .object({
    newArticle: z.boolean().optional(),
    aiComplete: z.boolean().optional(),
    follow: z.boolean().optional(),
    system: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "更新するフィールドを指定してください");

/** createNotificationSettingsRoute のオプション */
type NotificationSettingsRouteOptions = {
  db: Database;
};

/**
 * 通知設定レスポンスから機密フィールドを除外する
 *
 * @param settings - 通知設定データ
 * @returns userId を除いた通知設定データ
 */
function omitFields(settings: NotificationSettings): Record<string, unknown> {
  const result = { ...settings };
  for (const field of OMIT_FIELDS) {
    delete result[field];
  }
  return result;
}

/**
 * 通知設定ルートを生成する
 *
 * GET /notification-settings: 通知設定取得
 * PATCH /notification-settings: 通知設定更新
 *
 * @param options - DB インスタンス
 * @returns Hono ルーターインスタンス
 */
export function createNotificationSettingsRoute(options: NotificationSettingsRouteOptions) {
  const { db } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.get("/notification-settings", async (c) => {
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

    const [existing] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));

    if (existing) {
      return c.json({
        success: true,
        data: omitFields(existing),
      });
    }

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    const [created] = await db
      .insert(notificationSettings)
      .values({
        id: newId,
        userId,
        newArticle: true,
        aiComplete: true,
        follow: true,
        system: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();

    return c.json({
      success: true,
      data: omitFields(created),
    });
  });

  route.patch("/notification-settings", async (c) => {
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
    const validation = UpdateNotificationSettingsSchema.safeParse(body);

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

    const updateData = validation.data;

    const [existing] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));

    if (!existing) {
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .insert(notificationSettings)
        .values({
          id: newId,
          userId,
          newArticle: true,
          aiComplete: true,
          follow: true,
          system: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
    }

    try {
      const now = new Date().toISOString();
      const [updated] = await db
        .update(notificationSettings)
        .set({ ...updateData, updatedAt: now })
        .where(eq(notificationSettings.userId, userId))
        .returning();

      return c.json({
        success: true,
        data: omitFields(updated),
      });
    } catch (error) {
      logger.error("通知設定の更新に失敗しました", {
        userId,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      });
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "通知設定の更新に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  return route;
}
