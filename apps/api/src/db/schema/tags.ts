import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { articles } from "./articles";

/**
 * tagsテーブル
 * ユーザーごとのタグを管理する
 */
export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique("unq_tags_user_name").on(table.userId, table.name),
    index("idx_tags_user_id").on(table.userId),
  ],
);

/** tagsテーブルのSELECT型 */
export type Tag = typeof tags.$inferSelect;

/** tagsテーブルのINSERT型 */
export type NewTag = typeof tags.$inferInsert;

/**
 * article_tags中間テーブル
 * 記事とタグの多対多リレーションを管理する
 */
export const articleTags = sqliteTable(
  "article_tags",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.tagId] }),
  ],
);

/** article_tagsテーブルのSELECT型 */
export type ArticleTag = typeof articleTags.$inferSelect;

/** article_tagsテーブルのINSERT型 */
export type NewArticleTag = typeof articleTags.$inferInsert;
