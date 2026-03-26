import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * followsテーブル
 * ユーザー間のフォロー関係を管理する
 */
export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    index("idx_follows_follower").on(table.followerId),
    index("idx_follows_following").on(table.followingId),
  ],
);

/** followsテーブルのSELECT型 */
export type Follow = typeof follows.$inferSelect;

/** followsテーブルのINSERT型 */
export type NewFollow = typeof follows.$inferInsert;
