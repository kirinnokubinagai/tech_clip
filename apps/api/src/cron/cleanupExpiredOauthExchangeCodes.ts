import { lt } from "drizzle-orm";

import { oauthExchangeCodes } from "../db/schema";

/** 期限切れ OAuth exchange code クリーンアップの依存注入インターフェース */
export type OauthExchangeCodeCleanupDeps = {
  deleteExpiredOauthExchangeCodes: (currentTimestamp: string) => Promise<number>;
  getCurrentTimestamp: () => string;
};

/** 期限切れ OAuth exchange code クリーンアップの結果 */
type OauthExchangeCodeCleanupResult = {
  /** 常に true を返す（エラー時は例外をスロー）。他の cron ジョブとの一貫性のため success フィールドを保持 */
  success: boolean;
  deletedCount: number;
};

/**
 * 期限切れ OAuth exchange code を削除する
 *
 * @param deps - 依存注入（DB操作・現在時刻取得）
 * @returns クリーンアップ結果（成功フラグ・削除件数）
 */
export async function cleanupExpiredOauthExchangeCodes(
  deps: OauthExchangeCodeCleanupDeps,
): Promise<OauthExchangeCodeCleanupResult> {
  const currentTimestamp = deps.getCurrentTimestamp();
  const deletedCount = await deps.deleteExpiredOauthExchangeCodes(currentTimestamp);
  return { success: true, deletedCount };
}

/**
 * Drizzle ORM を使った deleteExpiredOauthExchangeCodes の実装を生成する
 *
 * @param db - Drizzle データベースインスタンス。既存の cron ジョブパターンとの一貫性を保つため
 *   loose な型 `{ delete: (table: unknown) => unknown }` を使用している
 * @returns OauthExchangeCodeCleanupDeps に適合した依存オブジェクト
 */
export function createOauthExchangeCodeCleanupDeps(db: {
  delete: (table: unknown) => unknown;
}): OauthExchangeCodeCleanupDeps {
  return {
    deleteExpiredOauthExchangeCodes: async (currentTimestamp) => {
      const result = await (
        db.delete(oauthExchangeCodes) as ReturnType<typeof db.delete> & {
          where: (condition: unknown) => { returning: () => Promise<unknown[]> };
        }
      )
        .where(lt(oauthExchangeCodes.expiresAt, currentTimestamp))
        .returning();
      return (result as unknown[]).length;
    },
    getCurrentTimestamp: () => new Date().toISOString(),
  };
}
