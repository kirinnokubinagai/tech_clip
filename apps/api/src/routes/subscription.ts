import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { users } from "../db/schema";

/**
 * 定数時間で2つの文字列を比較する
 *
 * タイミング攻撃を防ぐため、文字列の長さや一致位置に関わらず
 * 常に同じ時間で比較を完了する。
 *
 * @param a - 比較対象の文字列
 * @param b - 比較対象の文字列
 * @returns 一致する場合 true
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 400 Bad Request ステータスコード */
const HTTP_BAD_REQUEST = 400;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** 未認証エラーコード */
const AUTH_REQUIRED_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_REQUIRED_MESSAGE = "ログインが必要です";

/** 認証不正エラーコード */
const AUTH_INVALID_CODE = "AUTH_INVALID";

/** 認証不正エラーメッセージ */
const AUTH_INVALID_MESSAGE = "認証情報が正しくありません";

/** リクエスト不正エラーコード */
const INVALID_REQUEST_CODE = "INVALID_REQUEST";

/** リクエスト不正エラーメッセージ */
const INVALID_REQUEST_MESSAGE = "リクエストが正しくありません";

/** グレースピリオドの猶予日数 */
const GRACE_PERIOD_DAYS = 7;

/** 1日をミリ秒で表した値 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** プレミアムを有効化するイベントタイプ */
const PREMIUM_ACTIVATE_EVENTS = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
] as const;

/** プレミアムを無効化するイベントタイプ */
const PREMIUM_DEACTIVATE_EVENTS = ["EXPIRATION", "CANCELLATION", "BILLING_ISSUE"] as const;

/** RevenueCat Webhook ペイロードのバリデーションスキーマ */
const WebhookPayloadSchema = z.object({
  event: z.object({
    type: z.string().min(1, "イベントタイプは必須です"),
    app_user_id: z.string().min(1, "ユーザーIDは必須です"),
    expiration_at_ms: z.number().optional(),
  }),
});

/** createSubscriptionRouteのオプション */
type SubscriptionRouteOptions = {
  db: Database;
  webhookSecret: string;
};

/**
 * イベントタイプがプレミアム有効化イベントかどうかを判定する
 *
 * @param eventType - RevenueCat イベントタイプ
 * @returns プレミアム有効化イベントの場合 true
 */
function isActivateEvent(eventType: string): boolean {
  return (PREMIUM_ACTIVATE_EVENTS as readonly string[]).includes(eventType);
}

/**
 * イベントタイプがプレミアム無効化イベントかどうかを判定する
 *
 * @param eventType - RevenueCat イベントタイプ
 * @returns プレミアム無効化イベントの場合 true
 */
function isDeactivateEvent(eventType: string): boolean {
  return (PREMIUM_DEACTIVATE_EVENTS as readonly string[]).includes(eventType);
}

/**
 * ミリ秒タイムスタンプをISO 8601形式の文字列に変換する
 *
 * @param ms - ミリ秒タイムスタンプ
 * @returns ISO 8601形式の日時文字列
 */
function msToIsoString(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * グレースピリオド中かどうかを判定する
 *
 * isPremium が true かつ premiumExpiresAt が過去の日時の場合、
 * グレースピリオド中とみなす。WebhookやCronが isPremium を false に更新するまでの猶予期間。
 *
 * @param isPremium - プレミアムフラグ
 * @param premiumExpiresAt - プレミアム有効期限（ISO 8601文字列）
 * @returns グレースピリオド中の場合 true
 */
function isInGracePeriod(isPremium: boolean, premiumExpiresAt: string | null): boolean {
  if (!isPremium || !premiumExpiresAt) {
    return false;
  }
  const expiresAt = new Date(premiumExpiresAt).getTime();
  const now = Date.now();
  return expiresAt < now;
}

/**
 * グレースピリオド終了日時を計算する
 *
 * @param premiumExpiresAt - プレミアム有効期限（ISO 8601文字列）
 * @returns グレースピリオド終了日時（ISO 8601文字列）
 */
function calcGracePeriodEndsAt(premiumExpiresAt: string): string {
  const expiresAt = new Date(premiumExpiresAt).getTime();
  return new Date(expiresAt + GRACE_PERIOD_DAYS * ONE_DAY_MS).toISOString();
}

/**
 * サブスクリプションルートを生成する
 *
 * GET /status: サブスク状態確認（認証必須）
 * POST /cancel: サブスクリプションキャンセル（認証必須）
 * POST /webhooks/revenuecat: RevenueCat Webhook受信
 *
 * @param options - DB インスタンスとWebhookシークレット
 * @returns Hono ルーターインスタンス
 */
export function createSubscriptionRoute(options: SubscriptionRouteOptions) {
  const { db, webhookSecret } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.get("/status", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_REQUIRED_CODE,
            message: AUTH_REQUIRED_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id as string));

    if (!found) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "ユーザーが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const userData = found as unknown as Record<string, unknown>;
    const isPremium = (userData.isPremium ?? false) as boolean;
    const premiumExpiresAt = (userData.premiumExpiresAt ?? null) as string | null;
    const gracePeriod = isInGracePeriod(isPremium, premiumExpiresAt);
    const gracePeriodEndsAt =
      gracePeriod && premiumExpiresAt ? calcGracePeriodEndsAt(premiumExpiresAt) : null;

    return c.json(
      {
        success: true,
        data: {
          isPremium,
          premiumExpiresAt,
          isInGracePeriod: gracePeriod,
          gracePeriodEndsAt,
          isTrial: false,
        },
      },
      HTTP_OK,
    );
  });

  route.post("/cancel", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_REQUIRED_CODE,
            message: AUTH_REQUIRED_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id as string));

    if (!found) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "ユーザーが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const userData = found as unknown as Record<string, unknown>;
    if (!userData.isPremium) {
      return c.json(
        {
          success: false,
          error: {
            code: INVALID_REQUEST_CODE,
            message: "プレミアムサブスクリプションに加入していません",
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    return c.json(
      {
        success: true,
        data: {
          message:
            "ストアのサブスクリプション管理画面から解約手続きを行ってください。解約完了後、自動的にプレミアム状態が更新されます。",
          action: "redirect_to_store",
        },
      },
      HTTP_OK,
    );
  });

  route.post("/webhooks/revenuecat", async (c) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_REQUIRED_CODE,
            message: AUTH_REQUIRED_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const token = authHeader.replace("Bearer ", "");
    if (!timingSafeEqual(token, webhookSecret)) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_INVALID_CODE,
            message: AUTH_INVALID_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const validation = WebhookPayloadSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: {
            code: INVALID_REQUEST_CODE,
            message: INVALID_REQUEST_MESSAGE,
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const { event } = validation.data;
    const { type: eventType, app_user_id: appUserId } = event;

    const [existingUser] = await db.select().from(users).where(eq(users.id, appUserId));

    if (!existingUser) {
      return c.json(
        {
          success: true,
          data: {
            message: "ユーザーが見つかりませんでした。処理をスキップしました",
          },
        },
        HTTP_OK,
      );
    }

    if (isActivateEvent(eventType)) {
      const premiumExpiresAt = event.expiration_at_ms
        ? msToIsoString(event.expiration_at_ms)
        : null;

      await db
        .update(users)
        .set({
          isPremium: true,
          premiumExpiresAt,
        })
        .where(eq(users.id, appUserId));
    }

    if (isDeactivateEvent(eventType)) {
      await db
        .update(users)
        .set({
          isPremium: false,
          premiumExpiresAt: null,
        })
        .where(eq(users.id, appUserId));
    }

    return c.json(
      {
        success: true,
        data: {
          message: "Webhookを処理しました",
        },
      },
      HTTP_OK,
    );
  });

  return route;
}
