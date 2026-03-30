CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`properties` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_events_user_id` ON `analytics_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_event` ON `analytics_events` (`event`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_created_at` ON `analytics_events` (`created_at`);