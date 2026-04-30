CREATE TABLE `oauth_exchange_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session_token` text NOT NULL,
	`refresh_token_plain` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_exchange_codes_code_hash_unique` ON `oauth_exchange_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_oauth_exchange_codes_expires_at` ON `oauth_exchange_codes` (`expires_at`);