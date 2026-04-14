import { lt } from "drizzle-orm";

import { refreshTokens } from "../db/schema";

/** 期限切れリフレッシュトークンクリーンアップの依存注入インターフェース */
export type RefreshTokenCleanupDeps = {
  deleteExpiredRefreshTokens: (currentTimestamp: string) => Promise<number>;
  getCurrentTimestamp: () => string;
};

/** 期限切れリフレッシュトークンクリーンアップの結果 */
type RefreshTokenCleanupResult = {
  /** 常に true を返す（エラー時は例外をスロー）。他の cron ジョブとの一貫性のため success フィールドを保持 */
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
 * @param db - Drizzle データベースインスタンス。既存の cron ジョブパターンとの一貫性を保つため
 *   loose な型 `{ delete: (table: unknown) => unknown }` を使用している
 * @returns RefreshTokenCleanupDeps に適合した依存オブジェクト
 */
export function createRefreshTokenCleanupDeps(db: {
  delete: (table: unknown) => unknown;
}): RefreshTokenCleanupDeps {
  return {
    deleteExpiredRefreshTokens: async (currentTimestamp) => {
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
