import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";

import type { Database } from "../db";
import { users } from "../db/schema";

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 402 Payment Required ステータスコード */
const HTTP_PAYMENT_REQUIRED = 402;

/** 未認証エラーコード */
const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** AI使用回数上限エラーコード */
const AI_LIMIT_ERROR_CODE = "AI_LIMIT_EXCEEDED";

/** AI使用回数上限エラーメッセージ */
const AI_LIMIT_ERROR_MESSAGE =
  "無料のAI使用回数の上限に達しました。プレミアムプランにアップグレードしてください";

/** 無料ユーザーの月間AI使用上限回数 */
const FREE_AI_USES_PER_MONTH = 5;

/** 1ヶ月のミリ秒数（30日） */
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 次のリセット日時を計算する
 *
 * @returns 現在時刻から1ヶ月後のISO文字列
 */
function calculateNextResetAt(): string {
  return new Date(Date.now() + ONE_MONTH_MS).toISOString();
}

/**
 * リセット期限が過ぎているかチェックする
 *
 * @param resetAt - リセット予定日時のISO文字列（nullの場合は期限切れとみなす）
 * @returns 期限切れの場合true
 */
function isResetExpired(resetAt: string | null): boolean {
  if (!resetAt) {
    return true;
  }
  return new Date(resetAt).getTime() <= Date.now();
}

/** レスポンスが成功とみなす最大ステータスコード */
const HTTP_SUCCESS_MAX_STATUS = 399;

/**
 * AI使用回数制限ミドルウェアを生成する
 *
 * 要約/翻訳API呼び出し前にユーザーのfreeAiUsesRemainingをチェックし、
 * 無料ユーザーの使用回数を制限する。
 * - プレミアムユーザー: 制限なし（通過）
 * - 無料ユーザー（残回数あり）: 通過後にデクリメント（成功時のみ）
 * - 無料ユーザー（残回数なし、リセット期限切れ）: リセットして通過（成功時のみ適用）
 * - 無料ユーザー（残回数なし、リセット期限内）: 402を返却
 *
 * @param db - Drizzle ORMデータベースインスタンス
 * @returns Hono ミドルウェアハンドラー
 */
export function createAiLimitMiddleware(db: Database): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user") as Record<string, unknown> | undefined;

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

    const userResults = await db.select().from(users).where(eq(users.id, userId));

    if (userResults.length === 0) {
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

    const dbUser = userResults[0];

    if (dbUser.isPremium) {
      await next();
      return;
    }

    const remaining = dbUser.freeAiUsesRemaining ?? 0;

    if (remaining > 0) {
      await next();

      if (c.res.status <= HTTP_SUCCESS_MAX_STATUS) {
        await db
          .update(users)
          .set({
            freeAiUsesRemaining: remaining - 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, userId));
      }

      return;
    }

    if (isResetExpired(dbUser.freeAiResetAt)) {
      const nextResetAt = calculateNextResetAt();

      await next();

      if (c.res.status <= HTTP_SUCCESS_MAX_STATUS) {
        await db
          .update(users)
          .set({
            freeAiUsesRemaining: FREE_AI_USES_PER_MONTH - 1,
            freeAiResetAt: nextResetAt,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, userId));
      }

      return;
    }

    return c.json(
      {
        success: false,
        error: {
          code: AI_LIMIT_ERROR_CODE,
          message: AI_LIMIT_ERROR_MESSAGE,
        },
      },
      HTTP_PAYMENT_REQUIRED,
    );
  };
}
