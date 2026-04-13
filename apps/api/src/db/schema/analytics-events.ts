import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./users";

/**
 * analytics_eventsテーブル
 * モバイルアプリからのアナリティクスイベントを管理する
 */
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    properties: text("properties").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_analytics_events_user_id").on(table.userId),
    index("idx_analytics_events_event").on(table.event),
    index("idx_analytics_events_created_at").on(table.createdAt),
  ],
);

/** analytics_eventsテーブルのSELECT型 */
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

/** analytics_eventsテーブルのINSERT型 */
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
