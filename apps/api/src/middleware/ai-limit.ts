import { and, eq, gt, sql } from "drizzle-orm";
import type { Context, MiddlewareHandler, Next } from "hono";

import type { Database } from "../db";
import { users } from "../db/schema";
import { createLogger } from "../lib/logger";

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 402 Payment Required ステータスコード */
const HTTP_PAYMENT_REQUIRED = 402;

/** HTTP 400 Bad Request 以上はエラーレスポンス */
const HTTP_CLIENT_ERROR_MIN = 400;

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

/**
 * 既存の無料枠から1回分を予約する
 *
 * @param db - Drizzle ORMデータベースインスタンス
 * @param userId - ユーザーID
 * @returns 予約に成功した場合true
 */
async function reserveExistingFreeUse(db: Database, userId: string): Promise<boolean> {
  const reserved = await db
    .update(users)
    .set({
      freeAiUsesRemaining: sql`${users.freeAiUsesRemaining} - 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(users.id, userId), gt(users.freeAiUsesRemaining, 0)))
    .returning({ id: users.id });

  return reserved.length > 0;
}

/**
 * 月次リセットを伴う無料枠を1回分予約する
 *
 * @param db - Drizzle ORMデータベースインスタンス
 * @param userId - ユーザーID
 * @param resetReferenceTime - リセット判定に使う基準時刻
 * @param nextResetAt - 次回リセット日時
 * @returns 予約に成功した場合true
 */
async function reserveResetFreeUse(
  db: Database,
  userId: string,
  resetReferenceTime: string,
  nextResetAt: string,
): Promise<boolean> {
  const reserved = await db
    .update(users)
    .set({
      freeAiUsesRemaining: sql`CASE
        WHEN ${users.freeAiResetAt} IS NULL OR ${users.freeAiResetAt} <= ${resetReferenceTime}
          THEN ${FREE_AI_USES_PER_MONTH - 1}
        ELSE ${users.freeAiUsesRemaining} - 1
      END`,
      freeAiResetAt: sql`CASE
        WHEN ${users.freeAiResetAt} IS NULL OR ${users.freeAiResetAt} <= ${resetReferenceTime}
          THEN ${nextResetAt}
        ELSE ${users.freeAiResetAt}
      END`,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(users.id, userId),
        sql`(${users.freeAiResetAt} IS NULL OR ${users.freeAiResetAt} <= ${resetReferenceTime} OR ${users.freeAiUsesRemaining} > 0)`,
      ),
    )
    .returning({ id: users.id });

  return reserved.length > 0;
}

/**
 * 失敗したリクエスト分の無料枠予約を戻す
 *
 * 上限値（FREE_AI_USES_PER_MONTH）を超えないよう MIN でキャップする
 *
 * @param db - Drizzle ORMデータベースインスタンス
 * @param userId - ユーザーID
 */
async function rollbackReservedFreeUse(db: Database, userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      freeAiUsesRemaining: sql`MIN(${users.freeAiUsesRemaining} + 1, ${FREE_AI_USES_PER_MONTH})`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));
}

/**
 * ロールバックを安全に実行する。失敗してもクラッシュせずエラーをログ出力する
 *
 * @param db - Drizzle ORMデータベースインスタンス
 * @param userId - ユーザーID
 * @param logger - リクエストスコープのロガー
 */
async function safeRollback(
  db: Database,
  userId: string,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  try {
    await rollbackReservedFreeUse(db, userId);
  } catch (rollbackError) {
    logger.error("AIクォータのロールバックに失敗しました", { userId, error: rollbackError });
  }
}

/**
 * 予約済みの無料枠を保護しつつ下流ハンドラを実行する
 *
 * 下流が 4xx 以上のステータスを返した場合、または例外をスローした場合は
 * ロールバックを実行して消費回数を元に戻す
 *
 * @param c - Hono コンテキスト
 * @param next - 次のハンドラ
 * @param db - Drizzle ORMデータベースインスタンス
 * @param userId - ユーザーID
 * @param logger - リクエストスコープのロガー
 */
async function executeWithRollback(
  c: Context,
  next: Next,
  db: Database,
  userId: string,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  try {
    await next();
    if (c.res.status >= HTTP_CLIENT_ERROR_MIN) {
      await safeRollback(db, userId, logger);
    }
  } catch (error) {
    await safeRollback(db, userId, logger);
    throw error;
  }
}

/**
 * クォータ予約の競合時に警告を出し、402レスポンスを返す
 *
 * @param c - Hono コンテキスト
 * @param logger - リクエストスコープのロガー
 * @param userId - ユーザーID
 * @param path - 競合が発生した予約経路
 * @returns Payment Required レスポンス
 */
function respondReservationConflict(
  c: Context,
  logger: ReturnType<typeof createLogger>,
  userId: string,
  path: "existing-free-use" | "reset-free-use",
) {
  logger.warn("AIクォータ予約が競合で失敗しました", {
    userId,
    path,
  });

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
}

/**
 * AI使用回数制限ミドルウェアを生成する
 *
 * 要約/翻訳API呼び出し前にユーザーのfreeAiUsesRemainingをチェックし、
 * 無料ユーザーの使用回数を制限する。
 * - プレミアムユーザー: 制限なし（通過）
 * - 無料ユーザー（残回数あり）: 下流ハンドラ実行前に1回分を予約し、失敗時はロールバック
 * - 無料ユーザー（残回数なし、リセット期限切れ）: 月次枠を再設定しつつ1回分を予約し、失敗時はロールバック
 * - 無料ユーザー（残回数なし、リセット期限内）: 402を返却
 *
 * @param db - Drizzle ORMデータベースインスタンス
 * @returns Hono ミドルウェアハンドラー
 */
export function createAiLimitMiddleware(db: Database): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.get("requestId") as string | undefined;
    const logger = requestId ? createLogger(requestId) : createLogger();
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
      const didReserve = await reserveExistingFreeUse(db, userId);

      if (!didReserve) {
        return respondReservationConflict(c, logger, userId, "existing-free-use");
      }

      await executeWithRollback(c, next, db, userId, logger);
      return;
    }

    if (isResetExpired(dbUser.freeAiResetAt)) {
      const resetReferenceTime = new Date().toISOString();
      const nextResetAt = calculateNextResetAt();
      const didReserve = await reserveResetFreeUse(db, userId, resetReferenceTime, nextResetAt);

      if (!didReserve) {
        return respondReservationConflict(c, logger, userId, "reset-free-use");
      }

      await executeWithRollback(c, next, db, userId, logger);
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
