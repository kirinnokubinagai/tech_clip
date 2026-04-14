/** 期限切れリフレッシュトークンクリーンアップの依存注入インターフェース */
export type RefreshTokenCleanupDeps = {
  deleteExpiredRefreshTokens: (currentTimestamp: string) => Promise<number>;
  getCurrentTimestamp: () => string;
};

/** 期限切れリフレッシュトークンクリーンアップの結果 */
type RefreshTokenCleanupResult = {
  success: boolean;
  deletedCount: number;
};

/**
 * 期限切れリフレッシュトークンを削除する
 *
 * @param deps - 依存注入（DB操作・現在時刻取得）
 * @returns クリーンアップ結果（成功フラグ・削除件数）
 */
export async function cleanupExpiredRefreshTokens(
  deps: RefreshTokenCleanupDeps,
): Promise<RefreshTokenCleanupResult> {
  const currentTimestamp = deps.getCurrentTimestamp();
  const deletedCount = await deps.deleteExpiredRefreshTokens(currentTimestamp);
  return { success: true, deletedCount };
}

/**
 * Drizzle ORM を使った deleteExpiredRefreshTokens の実装を生成する
 *
 * @param db - Drizzle データベースインスタンス
 * @returns RefreshTokenCleanupDeps に適合した依存オブジェクト
 */
export function createRefreshTokenCleanupDeps(db: {
  delete: (table: unknown) => unknown;
}): RefreshTokenCleanupDeps {
  return {
    deleteExpiredRefreshTokens: async (currentTimestamp) => {
      const { lt } = await import("drizzle-orm");
      const { refreshTokens } = await import("../db/schema");
      const result = await (
        db.delete(refreshTokens) as ReturnType<typeof db.delete> & {
          where: (condition: unknown) => { returning: () => Promise<unknown[]> };
        }
      )
        .where(lt(refreshTokens.expiresAt, currentTimestamp))
        .returning();
      return (result as unknown[]).length;
    },
    getCurrentTimestamp: () => new Date().toISOString(),
  };
}
