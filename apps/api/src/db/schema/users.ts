import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * usersテーブル（最小スタブ）
 * 完全な定義は Issue #26 で作成される
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
});
