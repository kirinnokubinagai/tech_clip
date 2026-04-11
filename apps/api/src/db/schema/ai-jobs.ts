import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { articles } from "./articles";

/**
 * ai_jobsテーブル
 * Workers AI の非同期ジョブ状態を追跡する
 */
export const aiJobs = sqliteTable(
  "ai_jobs",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    requestKey: text("request_key").notNull(),
    jobType: text("job_type").notNull(),
    language: text("language"),
    status: text("status").notNull(),
    providerJobId: text("provider_job_id"),
    model: text("model").notNull(),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("idx_ai_jobs_article").on(table.articleId),
    index("idx_ai_jobs_request_key").on(table.requestKey),
    index("idx_ai_jobs_status").on(table.status),
  ],
);

export type AiJob = typeof aiJobs.$inferSelect;
export type NewAiJob = typeof aiJobs.$inferInsert;
