import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * articlesテーブル
 * ユーザーが保存した記事を管理する
 */
export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    excerpt: text("excerpt"),
    author: text("author"),
    source: text("source").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    savedBy: text("saved_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_articles_saved_by").on(table.savedBy),
    index("idx_articles_source").on(table.source),
    index("idx_articles_created_at").on(table.createdAt),
  ],
);

/** articlesテーブルのSELECT型 */
export type Article = typeof articles.$inferSelect;

/** articlesテーブルのINSERT型 */
export type NewArticle = typeof articles.$inferInsert;
