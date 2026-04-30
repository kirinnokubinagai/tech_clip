CREATE INDEX `idx_notifications_recipient_created` ON `notifications` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);