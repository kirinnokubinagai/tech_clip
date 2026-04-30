ALTER TABLE `refresh_tokens` ADD `previous_token_hash` text;
CREATE INDEX `idx_refresh_tokens_previous_token_hash` ON `refresh_tokens` (`previous_token_hash`);
