import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * notificationsテーブル
 * プッシュ通知・アプリ内通知を管理する
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).default(false),
    data: text("data"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_notifications_user").on(table.userId),
    index("idx_notifications_user_unread").on(table.userId, table.isRead),
  ],
);

/** notificationsテーブルのSELECT型 */
export type Notification = typeof notifications.$inferSelect;

/** notificationsテーブルのINSERT型 */
export type NewNotification = typeof notifications.$inferInsert;
