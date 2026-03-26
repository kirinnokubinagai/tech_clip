import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * verificationsテーブル
 * Better Auth が要求するメール認証・パスワードリセット等の検証トークン管理テーブル
 */
export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** verifications テーブルの SELECT 結果の型 */
export type Verification = typeof verifications.$inferSelect;

/** verifications テーブルへの INSERT データの型 */
export type NewVerification = typeof verifications.$inferInsert;
