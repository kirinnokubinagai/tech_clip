import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sessions } from "./sessions";
import { users } from "./users";

/**
 * oauth_exchange_codes テーブル
 *
 * モバイル OAuth コールバックで発行する一度限りの exchange code を管理する。
 * code_hash で SELECT、consumed_at セット後に DELETE する短命レコード。
 */
export const oauthExchangeCodes = sqliteTable(
  "oauth_exchange_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull().unique(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull(),
    refreshTokenPlain: text("refresh_token_plain").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_oauth_exchange_codes_expires_at").on(table.expiresAt)],
);

/** oauth_exchange_codes テーブルの SELECT 結果の型 */
export type OauthExchangeCode = typeof oauthExchangeCodes.$inferSelect;

/** oauth_exchange_codes テーブルへの INSERT データの型 */
export type NewOauthExchangeCode = typeof oauthExchangeCodes.$inferInsert;
