import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  // Better Auth 必須フィールド
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  // プロフィール拡張
  username: text("username").unique(),
  bio: text("bio"),
  websiteUrl: text("website_url"),
  githubUsername: text("github_username"),
  twitterUsername: text("twitter_username"),
  avatarUrl: text("avatar_url"),
  isProfilePublic: integer("is_profile_public", { mode: "boolean" }).default(true),
  // 設定
  preferredLanguage: text("preferred_language").default("ja"),
  // サブスク管理
  isPremium: integer("is_premium", { mode: "boolean" }).default(false),
  premiumExpiresAt: text("premium_expires_at"),
  freeAiUsesRemaining: integer("free_ai_uses_remaining").default(5),
  freeAiResetAt: text("free_ai_reset_at"),
  // プッシュ通知
  pushToken: text("push_token"),
  pushEnabled: integer("push_enabled", { mode: "boolean" }).default(true),
  // タイムスタンプ
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

/** users テーブルの SELECT 結果の型 */
export type User = typeof users.$inferSelect;

/** users テーブルへの INSERT データの型 */
export type NewUser = typeof users.$inferInsert;
