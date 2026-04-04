import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sessions } from "./sessions";
import { users } from "./users";

/**
 * refresh_tokensテーブル
 * モバイルクライアント向けのリフレッシュトークンを管理する
 *
 * @todo 期限切れトークンの定期クリーンアップ - 将来的にCronジョブで実装する
 *   例: `DELETE FROM refresh_tokens WHERE expires_at < datetime('now')`
 *   を定期的に実行して、DBの肥大化を防ぐ
 */
export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  previousTokenHash: text("previous_token_hash"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** refresh_tokens テーブルの SELECT 結果の型 */
export type RefreshToken = typeof refreshTokens.$inferSelect;

/** refresh_tokens テーブルへの INSERT データの型 */
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
