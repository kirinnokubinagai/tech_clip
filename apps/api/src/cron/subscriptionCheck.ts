/** サブスクリプションチェックの依存注入インターフェース */
export type SubscriptionCheckDeps = {
  disableExpiredPremiumUsers: (params: {
    isPremium: boolean;
    currentTimestamp: string;
  }) => Promise<number>;
  getCurrentTimestamp: () => string;
};

/** サブスクリプションチェックの結果 */
type SubscriptionCheckResult = {
  success: boolean;
  disabledCount: number;
};

/**
 * 期限切れのプレミアムサブスクリプションを無効化する
 *
 * @param deps - 依存注入（DB操作・現在時刻取得）
 * @returns チェック結果（成功フラグ・無効化件数）
 */
export async function disableExpiredSubscriptions(
  deps: SubscriptionCheckDeps,
): Promise<SubscriptionCheckResult> {
  const currentTimestamp = deps.getCurrentTimestamp();
  const disabledCount = await deps.disableExpiredPremiumUsers({
    isPremium: false,
    currentTimestamp,
  });

  return { success: true, disabledCount };
}

/**
 * Drizzle ORM を使った disableExpiredPremiumUsers の実装を生成する
 *
 * @param db - Drizzle データベースインスタンス
 * @returns SubscriptionCheckDeps に適合した依存オブジェクト
 */
export function createSubscriptionCheckDeps(db: {
  update: (table: unknown) => unknown;
}): SubscriptionCheckDeps {
  return {
    disableExpiredPremiumUsers: async (params) => {
      const { and, eq, lt } = await import("drizzle-orm");
      const { users } = await import("../db/schema");
      const result = await (
        db.update(users) as ReturnType<typeof db.update> & {
          set: (values: unknown) => {
            where: (condition: unknown) => { returning: () => Promise<unknown[]> };
          };
        }
      )
        .set({ isPremium: params.isPremium })
        .where(and(eq(users.isPremium, true), lt(users.premiumExpiresAt, params.currentTimestamp)))
        .returning();
      return (result as unknown[]).length;
    },
    getCurrentTimestamp: () => new Date().toISOString(),
  };
}
