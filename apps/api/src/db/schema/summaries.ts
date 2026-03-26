import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { articles } from "./articles";

/**
 * summariesテーブル
 * AI要約結果をキャッシュする
 */
export const summaries = sqliteTable(
  "summaries",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    summary: text("summary").notNull(),
    model: text("model").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique("unq_summaries_article_language").on(
      table.articleId,
      table.language,
    ),
    index("idx_summaries_article").on(table.articleId),
  ],
);

/** summariesテーブルのSELECT型 */
export type Summary = typeof summaries.$inferSelect;

/** summariesテーブルのINSERT型 */
export type NewSummary = typeof summaries.$inferInsert;
