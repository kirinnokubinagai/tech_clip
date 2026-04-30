import type { createLogger } from "../lib/logger";
import { FREE_AI_USES_PER_MONTH } from "../middleware/ai-limit";

/** ロールバック失敗補正バッチの依存注入インターフェース */
export type ReconcileFailedRollbacksDeps = {
  fetchUnresolvedFailures: () => Promise<Array<{ id: string; userId: string }>>;
  /**
   * userId の freeAiUsesRemaining を +1 補正し、failureId を resolved_at 付きでマークする。
   * 2 操作はトランザクション内でアトミックに実行されること。
   */
  compensateAndMarkResolved: (
    userId: string,
    failureId: string,
    appliedAdjustment: string,
    resolvedAt: string,
  ) => Promise<void>;
  getCurrentTimestamp: () => string;
  logger: ReturnType<typeof createLogger>;
};

/** ロールバック失敗補正バッチの結果 */
export type ReconcileFailedRollbacksResult = {
  success: boolean;
  processedCount: number;
  failedCount: number;
};

/**
 * 未処理のロールバック失敗レコードを補正する月次バッチ
 *
 * ai_quota_rollback_failures で resolved_at IS NULL のレコードに対し、
 * ユーザーの freeAiUsesRemaining を MIN(remaining + 1, 5) で補正する。
 *
 * @param deps - 依存注入（DB操作・現在時刻取得・ロガー）
 * @returns 補正結果（成功フラグ・処理件数・失敗件数）
 */
export async function reconcileFailedRollbacks(
  deps: ReconcileFailedRollbacksDeps,
): Promise<ReconcileFailedRollbacksResult> {
  const failures = await deps.fetchUnresolvedFailures();
  let processed = 0;
  let failed = 0;

  for (const failure of failures) {
    try {
      await deps.compensateAndMarkResolved(
        failure.userId,
        failure.id,
        "+1",
        deps.getCurrentTimestamp(),
      );
      processed++;
    } catch (error) {
      deps.logger.error("ロールバック失敗の補正に失敗しました", {
        failureId: failure.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  return { success: failed === 0, processedCount: processed, failedCount: failed };
}

/**
 * Drizzle ORM を使った ReconcileFailedRollbacksDeps の実装を生成する
 *
 * @param db - Drizzle データベースインスタンス（transaction() メソッドを持つこと）
 * @param logger - ロガー
 * @returns ReconcileFailedRollbacksDeps に適合した依存オブジェクト
 */
export function createReconcileFailedRollbacksDeps(
  db: {
    select: (fields?: unknown) => unknown;
    update: (table: unknown) => unknown;
    transaction: <T>(fn: (tx: { update: (table: unknown) => unknown }) => Promise<T>) => Promise<T>;
  },
  logger: ReturnType<typeof createLogger>,
): ReconcileFailedRollbacksDeps {
  return {
    fetchUnresolvedFailures: async () => {
      const { isNull } = await import("drizzle-orm");
      const { aiQuotaRollbackFailures } = await import("../db/schema");
      return (
        db.select({ id: aiQuotaRollbackFailures.id, userId: aiQuotaRollbackFailures.userId }) as {
          from: (table: unknown) => {
            where: (cond: unknown) => Promise<Array<{ id: string; userId: string }>>;
          };
        }
      )
        .from(aiQuotaRollbackFailures)
        .where(isNull(aiQuotaRollbackFailures.resolvedAt));
    },
    compensateAndMarkResolved: async (userId, failureId, appliedAdjustment, resolvedAt) => {
      const { eq, sql } = await import("drizzle-orm");
      const { users, aiQuotaRollbackFailures } = await import("../db/schema");
      await db.transaction(async (tx) => {
        await (
          tx.update(users) as {
            set: (values: unknown) => { where: (cond: unknown) => Promise<void> };
          }
        )
          .set({
            freeAiUsesRemaining: sql`MIN(${users.freeAiUsesRemaining} + 1, ${FREE_AI_USES_PER_MONTH})`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, userId));
        await (
          tx.update(aiQuotaRollbackFailures) as {
            set: (values: unknown) => { where: (cond: unknown) => Promise<void> };
          }
        )
          .set({ resolvedAt, appliedAdjustment })
          .where(eq(aiQuotaRollbackFailures.id, failureId));
      });
    },
    getCurrentTimestamp: () => new Date().toISOString(),
    logger,
  };
}
