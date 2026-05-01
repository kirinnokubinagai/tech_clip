CREATE TABLE `ai_quota_rollback_failures` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reservation_path` text NOT NULL,
	`error_message` text,
	`occurred_at` text DEFAULT (datetime('now')) NOT NULL,
	`resolved_at` text,
	`applied_adjustment` text
);
--> statement-breakpoint
CREATE INDEX `idx_ai_quota_rollback_failures_unresolved` ON `ai_quota_rollback_failures` (`occurred_at`);