import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./users";

/**
 * sessionsテーブル
 * Better Auth が要求するセッション管理テーブル
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** sessions テーブルの SELECT 結果の型 */
export type Session = typeof sessions.$inferSelect;

/** sessions テーブルへの INSERT データの型 */
export type NewSession = typeof sessions.$inferInsert;
