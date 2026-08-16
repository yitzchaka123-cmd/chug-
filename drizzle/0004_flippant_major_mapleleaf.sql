CREATE TABLE `group_announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_announcements_group_created_idx` ON `group_announcements` (`group_id`,`created_at`);