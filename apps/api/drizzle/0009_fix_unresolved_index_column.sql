DROP INDEX `idx_ai_quota_rollback_failures_unresolved`;--> statement-breakpoint
CREATE INDEX `idx_ai_quota_rollback_failures_unresolved` ON `ai_quota_rollback_failures` (`resolved_at`);