CREATE TABLE `admin_recovery_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text DEFAULT 'passcode_reset' NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_recovery_tokens_hash_unique` ON `admin_recovery_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `admin_recovery_tokens_user_expiry_idx` ON `admin_recovery_tokens` (`admin_user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `admin_recovery_tokens_expiry_consumed_idx` ON `admin_recovery_tokens` (`expires_at`,`consumed_at`);