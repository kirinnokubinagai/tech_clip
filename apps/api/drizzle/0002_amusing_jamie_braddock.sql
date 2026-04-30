CREATE TABLE `ai_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`request_key` text NOT NULL,
	`job_type` text NOT NULL,
	`language` text,
	`status` text NOT NULL,
	`provider_job_id` text,
	`model` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_article` ON `ai_jobs` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_request_key` ON `ai_jobs` (`request_key`);--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_status` ON `ai_jobs` (`status`);