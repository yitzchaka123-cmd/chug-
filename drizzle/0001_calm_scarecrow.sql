CREATE TABLE `backup_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`reason` text DEFAULT 'automatic' NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backup_snapshots_storage_key_unique` ON `backup_snapshots` (`storage_key`);--> statement-breakpoint
CREATE INDEX `backup_snapshots_created_idx` ON `backup_snapshots` (`created_at`);--> statement-breakpoint
CREATE TABLE `brand_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'logo' NOT NULL,
	`name` text NOT NULL,
	`stored_file_id` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`stored_file_id`) REFERENCES `stored_files`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `brand_assets_kind_current_idx` ON `brand_assets` (`kind`,`is_current`,`status`);--> statement-breakpoint
CREATE TABLE `creative_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`style` text,
	`facts_json` text DEFAULT '{}' NOT NULL,
	`prompt_text` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `creative_prompts_year_kind_idx` ON `creative_prompts` (`school_year_id`,`kind`);--> statement-breakpoint
CREATE INDEX `creative_prompts_updated_idx` ON `creative_prompts` (`updated_at`);--> statement-breakpoint
CREATE TABLE `custom_registration_links` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text NOT NULL,
	`group_id` text,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_ciphertext` text NOT NULL,
	`registration_fee_agorot` integer,
	`monthly_fee_agorot` integer,
	`june_fee_agorot` integer,
	`security_check_agorot` integer,
	`one_time_amount_agorot` integer,
	`month_overrides_json` text DEFAULT '{}' NOT NULL,
	`allowed_payment_method` text,
	`proof_policy` text,
	`private_note_ciphertext` text,
	`status` text DEFAULT 'active' NOT NULL,
	`max_uses` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`disabled_at` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_registration_links_token_hash_unique` ON `custom_registration_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `custom_registration_links_year_status_idx` ON `custom_registration_links` (`school_year_id`,`status`);--> statement-breakpoint
CREATE INDEX `custom_registration_links_group_idx` ON `custom_registration_links` (`group_id`);--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text,
	`recipient_hash` text NOT NULL,
	`recipient_ciphertext` text NOT NULL,
	`message_ciphertext` text NOT NULL,
	`template` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`provider_message_id` text,
	`last_error` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_outbox_dedupe_key_unique` ON `email_outbox` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `email_outbox_status_created_idx` ON `email_outbox` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_outbox_registration_idx` ON `email_outbox` (`registration_id`);--> statement-breakpoint
CREATE INDEX `email_outbox_recipient_created_idx` ON `email_outbox` (`recipient_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text NOT NULL,
	`name` text NOT NULL,
	`age_min` integer,
	`age_max` integer,
	`weekday` integer DEFAULT 3 NOT NULL,
	`start_time` text,
	`end_time` text,
	`session_length_minutes` integer DEFAULT 50 NOT NULL,
	`location` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`announcement_title` text,
	`announcement_body` text,
	`announcement_updated_at` text,
	`share_token_hash` text,
	`share_token_ciphertext` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_year_name_unique` ON `groups` (`school_year_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_share_token_hash_unique` ON `groups` (`share_token_hash`);--> statement-breakpoint
CREATE INDEX `groups_year_status_idx` ON `groups` (`school_year_id`,`status`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`proof_policy` text DEFAULT 'optional' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_year_code_unique` ON `payment_methods` (`school_year_id`,`code`);--> statement-breakpoint
CREATE INDEX `payment_methods_year_enabled_sort_idx` ON `payment_methods` (`school_year_id`,`enabled`,`sort_order`);--> statement-breakpoint
CREATE TABLE `saved_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text,
	`group_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`page_size` text DEFAULT 'A4' NOT NULL,
	`content_json` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `saved_documents_year_kind_idx` ON `saved_documents` (`school_year_id`,`kind`);--> statement-breakpoint
CREATE INDEX `saved_documents_group_kind_idx` ON `saved_documents` (`group_id`,`kind`);--> statement-breakpoint
CREATE TABLE `schedule_events` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text NOT NULL,
	`group_id` text,
	`kind` text DEFAULT 'session' NOT NULL,
	`title_en` text DEFAULT 'Choir session' NOT NULL,
	`title_he` text,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`location` text,
	`note` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_key` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_events_group_source_key_unique` ON `schedule_events` (`group_id`,`source_key`);--> statement-breakpoint
CREATE INDEX `schedule_events_year_start_idx` ON `schedule_events` (`school_year_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `schedule_events_group_start_idx` ON `schedule_events` (`group_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `schedule_events_group_status_idx` ON `schedule_events` (`group_id`,`status`);--> statement-breakpoint
CREATE TABLE `schedule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`scope_json` text DEFAULT '{}' NOT NULL,
	`snapshot_json` text NOT NULL,
	`status` text DEFAULT 'finalized' NOT NULL,
	`finalized_by` text,
	`finalized_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_versions_year_version_unique` ON `schedule_versions` (`school_year_id`,`version`);--> statement-breakpoint
CREATE INDEX `schedule_versions_year_finalized_idx` ON `schedule_versions` (`school_year_id`,`finalized_at`);--> statement-breakpoint
ALTER TABLE `enrollments` ADD `group_id` text REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `enrollments` ADD `schedule_token_hash` text;--> statement-breakpoint
ALTER TABLE `enrollments` ADD `schedule_token_ciphertext` text;--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_schedule_token_hash_unique` ON `enrollments` (`schedule_token_hash`);--> statement-breakpoint
CREATE INDEX `enrollments_group_status_idx` ON `enrollments` (`group_id`,`status`);--> statement-breakpoint
ALTER TABLE `registrations` ADD `custom_registration_link_id` text;--> statement-breakpoint
ALTER TABLE `registrations` ADD `review_status` text DEFAULT 'awaiting_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `registrations` ADD `approved_at` text;--> statement-breakpoint
ALTER TABLE `registrations` ADD `approved_by` text;--> statement-breakpoint
ALTER TABLE `registrations` ADD `draft_expires_at` text;--> statement-breakpoint
CREATE INDEX `registrations_year_review_idx` ON `registrations` (`school_year_id`,`review_status`);--> statement-breakpoint
CREATE INDEX `registrations_custom_link_idx` ON `registrations` (`custom_registration_link_id`);--> statement-breakpoint
CREATE INDEX `registrations_draft_expiry_idx` ON `registrations` (`status`,`draft_expires_at`);