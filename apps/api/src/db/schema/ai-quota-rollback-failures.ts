import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * ai_quota_rollback_failures テーブル
 * AIクォータのロールバック失敗を記録し、月次 cron による補正の対象とする
 */
export const aiQuotaRollbackFailures = sqliteTable(
  "ai_quota_rollback_failures",
  {
    /** ULID */
    id: text("id").primaryKey(),
    /** 失敗したユーザーの ID (users.id への論理参照、外部キー制約は付けない: cron が users 削除後でも記録を保つため) */
    userId: text("user_id").notNull(),
    /** 失敗発生時の予約経路 ("existing-free-use" | "reset-free-use") */
    reservationPath: text("reservation_path").notNull(),
    /** ロールバック失敗時のエラーメッセージ (Error.message)。最大 1024 文字に切り詰める */
    errorMessage: text("error_message"),
    /** 失敗発生時刻 (ISO 8601) */
    occurredAt: text("occurred_at").notNull().default(sql`(datetime('now'))`),
    /** 補正バッチが処理を完了した時刻 (未処理は NULL) */
    resolvedAt: text("resolved_at"),
    /** 補正バッチが適用した補正値 (例: "+1") */
    appliedAdjustment: text("applied_adjustment"),
  },
  (table) => [
    /** 未処理レコード検索用インデックス */
    index("idx_ai_quota_rollback_failures_unresolved").on(table.resolvedAt),
  ],
);

export type AiQuotaRollbackFailure = typeof aiQuotaRollbackFailures.$inferSelect;
export type NewAiQuotaRollbackFailure = typeof aiQuotaRollbackFailures.$inferInsert;
