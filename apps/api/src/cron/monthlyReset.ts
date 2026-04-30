/** フリーAI使用回数リセットの依存注入インターフェース */
export type MonthlyResetDeps = {
  resetFreeUsers: (params: {
    freeAiUsesRemaining: number;
    freeAiResetAt: string;
  }) => Promise<number>;
  getCurrentTimestamp: () => string;
};

/** フリーAI使用回数リセットの結果 */
type MonthlyResetResult = {
  success: boolean;
  updatedCount: number;
};

/** 無料ユーザーへの月次AIリセット回数 */
const FREE_AI_USES_MONTHLY = 5;

/**
 * フリーユーザーのAI使用回数を月次リセットする
 *
 * @param deps - 依存注入（DB操作・現在時刻取得）
 * @returns リセット結果（成功フラグ・更新件数）
 */
export async function resetFreeAiUsesMonthly(deps: MonthlyResetDeps): Promise<MonthlyResetResult> {
  const currentTimestamp = deps.getCurrentTimestamp();
  const updatedCount = await deps.resetFreeUsers({
    freeAiUsesRemaining: FREE_AI_USES_MONTHLY,
    freeAiResetAt: currentTimestamp,
  });

  return { success: true, updatedCount };
}

/**
 * Drizzle ORM を使った resetFreeUsers の実装を生成する
 *
 * @param db - Drizzle データベースインスタンス
 * @returns MonthlyResetDeps に適合した依存オブジェクト
 */
export function createMonthlyResetDeps(db: {
  update: (table: unknown) => unknown;
}): MonthlyResetDeps {
  return {
    resetFreeUsers: async (params) => {
      const { eq } = await import("drizzle-orm");
      const { users } = await import("../db/schema");
      const result = await (
        db.update(users) as ReturnType<typeof db.update> & {
          set: (values: unknown) => {
            where: (condition: unknown) => { returning: () => Promise<unknown[]> };
          };
        }
      )
        .set({
          freeAiUsesRemaining: params.freeAiUsesRemaining,
          freeAiResetAt: params.freeAiResetAt,
        })
        .where(eq(users.isPremium, false))
        .returning();
      return (result as unknown[]).length;
    },
    getCurrentTimestamp: () => new Date().toISOString(),
  };
}
