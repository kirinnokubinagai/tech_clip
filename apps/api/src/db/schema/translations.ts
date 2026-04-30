import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { articles } from "./articles";

/**
 * translationsテーブル
 * AI翻訳結果をキャッシュする
 */
export const translations = sqliteTable(
  "translations",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    targetLanguage: text("target_language").notNull(),
    translatedTitle: text("translated_title").notNull(),
    translatedContent: text("translated_content").notNull(),
    model: text("model").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique("unq_translations_article_language").on(table.articleId, table.targetLanguage),
    index("idx_translations_article").on(table.articleId),
  ],
);

/** translationsテーブルのSELECT型 */
export type Translation = typeof translations.$inferSelect;

/** translationsテーブルのINSERT型 */
export type NewTranslation = typeof translations.$inferInsert;
