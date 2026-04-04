CREATE TABLE `refresh_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `sessions`(`id`) ON DELETE cascade,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_hash_unique` ON `refresh_tokens` (`token_hash`);
