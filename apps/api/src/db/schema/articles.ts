import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * articlesテーブル
 * ユーザーが保存した記事を管理する
 */
export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    source: text("source").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    content: text("content"),
    excerpt: text("excerpt"),
    thumbnailUrl: text("thumbnail_url"),
    readingTimeMinutes: integer("reading_time_minutes"),
    isRead: integer("is_read", { mode: "boolean" }).default(false),
    isFavorite: integer("is_favorite", { mode: "boolean" }).default(false),
    isPublic: integer("is_public", { mode: "boolean" }).default(false),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique("unq_articles_user_url").on(table.userId, table.url),
    index("idx_articles_user_id").on(table.userId),
    index("idx_articles_source").on(table.source),
    index("idx_articles_created_at").on(table.createdAt),
    index("idx_articles_published_at").on(table.publishedAt),
  ],
);

/** articlesテーブルのSELECT型 */
export type Article = typeof articles.$inferSelect;

/** articlesテーブルのINSERT型 */
export type NewArticle = typeof articles.$inferInsert;
