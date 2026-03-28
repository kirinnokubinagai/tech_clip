import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * notification_settings テーブル
 * ユーザーごとの通知種別ON/OFF設定を管理する
 */
export const notificationSettings = sqliteTable("notification_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 新着記事通知 */
  newArticle: integer("new_article", { mode: "boolean" }).notNull().default(true),
  /** AI要約完了通知 */
  aiComplete: integer("ai_complete", { mode: "boolean" }).notNull().default(true),
  /** フォロー通知 */
  follow: integer("follow", { mode: "boolean" }).notNull().default(true),
  /** システム通知 */
  system: integer("system", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** notification_settings テーブルの SELECT 結果の型 */
export type NotificationSettings = typeof notificationSettings.$inferSelect;

/** notification_settings テーブルへの INSERT データの型 */
export type NewNotificationSettings = typeof notificationSettings.$inferInsert;
