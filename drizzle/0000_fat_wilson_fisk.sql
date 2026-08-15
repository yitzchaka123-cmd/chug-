CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`ip_hash` text,
	`user_agent_hash` text,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_sessions_token_hash_unique` ON `admin_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `admin_sessions_user_expires_idx` ON `admin_sessions` (`admin_user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `admin_sessions_expires_revoked_idx` ON `admin_sessions` (`expires_at`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text DEFAULT 'Administrator' NOT NULL,
	`passcode_hash` text NOT NULL,
	`passcode_salt` text NOT NULL,
	`passcode_updated_at` text NOT NULL,
	`recovery_email` text,
	`recovery_email_verified` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE INDEX `admin_users_status_idx` ON `admin_users` (`status`);--> statement-breakpoint
CREATE TABLE `agreement_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`sections_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`effective_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agreement_versions_year_version_unique` ON `agreement_versions` (`school_year_id`,`version`);--> statement-breakpoint
CREATE INDEX `agreement_versions_year_active_idx` ON `agreement_versions` (`school_year_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `agreement_versions_content_hash_idx` ON `agreement_versions` (`content_hash`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_year_id` text,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text,
	`changes_json` text DEFAULT '{}' NOT NULL,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_entity_created_idx` ON `audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_created_idx` ON `audit_log` (`actor_type`,`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_year_created_idx` ON `audit_log` (`school_year_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identifier_hash` text NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`first_failure_at` text,
	`last_failure_at` text,
	`blocked_until` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_attempts_identifier_hash_unique` ON `auth_attempts` (`identifier_hash`);--> statement-breakpoint
CREATE INDEX `auth_attempts_blocked_until_idx` ON `auth_attempts` (`blocked_until`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`school_year_id` text NOT NULL,
	`registration_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`group_label` text,
	`registration_fee_agorot` integer DEFAULT 0 NOT NULL,
	`monthly_fee_agorot` integer DEFAULT 0 NOT NULL,
	`june_fee_agorot` integer DEFAULT 0 NOT NULL,
	`security_check_agorot` integer DEFAULT 0 NOT NULL,
	`enrolled_at` text NOT NULL,
	`left_at` text,
	`archive_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_student_year_unique` ON `enrollments` (`student_id`,`school_year_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_registration_unique` ON `enrollments` (`registration_id`);--> statement-breakpoint
CREATE INDEX `enrollments_year_status_idx` ON `enrollments` (`school_year_id`,`status`);--> statement-breakpoint
CREATE INDEX `enrollments_year_group_idx` ON `enrollments` (`school_year_id`,`group_label`);--> statement-breakpoint
CREATE TABLE `payment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`school_year_id` text NOT NULL,
	`registration_id` text,
	`proof_file_id` text,
	`period_key` text NOT NULL,
	`label` text NOT NULL,
	`due_on` text,
	`amount_due_agorot` integer NOT NULL,
	`amount_paid_agorot` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`method` text,
	`marked_paid_at` text,
	`marked_paid_by` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`proof_file_id`) REFERENCES `stored_files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_items_enrollment_period_unique` ON `payment_items` (`enrollment_id`,`period_key`);--> statement-breakpoint
CREATE INDEX `payment_items_year_status_due_idx` ON `payment_items` (`school_year_id`,`status`,`due_on`);--> statement-breakpoint
CREATE INDEX `payment_items_registration_idx` ON `payment_items` (`registration_id`);--> statement-breakpoint
CREATE TABLE `registration_section_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_id` text NOT NULL,
	`agreement_version_id` text NOT NULL,
	`section_key` text NOT NULL,
	`section_title` text NOT NULL,
	`section_hash` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agreement_version_id`) REFERENCES `agreement_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registration_section_approvals_registration_section_unique` ON `registration_section_approvals` (`registration_id`,`section_key`);--> statement-breakpoint
CREATE INDEX `registration_section_approvals_agreement_idx` ON `registration_section_approvals` (`agreement_version_id`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`school_year_id` text NOT NULL,
	`agreement_version_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`participant_full_name` text NOT NULL,
	`participant_birth_date` text,
	`father_name` text,
	`father_phone` text,
	`father_email` text,
	`mother_name` text,
	`mother_phone` text,
	`mother_email` text,
	`emergency_contact_name` text,
	`emergency_contact_phone` text,
	`emergency_contact_relation` text,
	`medical_information_ciphertext` text,
	`medical_information_iv` text,
	`payment_method` text,
	`registration_fee_agorot` integer DEFAULT 0 NOT NULL,
	`monthly_fee_agorot` integer DEFAULT 0 NOT NULL,
	`june_fee_agorot` integer DEFAULT 0 NOT NULL,
	`security_check_agorot` integer DEFAULT 0 NOT NULL,
	`payment_proof_status` text DEFAULT 'not_required' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`pricing_snapshot_json` text DEFAULT '{}' NOT NULL,
	`form_snapshot_json` text DEFAULT '{}' NOT NULL,
	`draft_token_hash` text,
	`download_token_hash` text,
	`submitted_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_year_id`) REFERENCES `school_years`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`agreement_version_id`) REFERENCES `agreement_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `registrations_year_status_idx` ON `registrations` (`school_year_id`,`status`);--> statement-breakpoint
CREATE INDEX `registrations_participant_name_idx` ON `registrations` (`participant_full_name`);--> statement-breakpoint
CREATE INDEX `registrations_submitted_at_idx` ON `registrations` (`submitted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_draft_token_hash_unique` ON `registrations` (`draft_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_download_token_hash_unique` ON `registrations` (`download_token_hash`);--> statement-breakpoint
CREATE TABLE `school_years` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`currency` text DEFAULT 'ILS' NOT NULL,
	`registration_fee_agorot` integer DEFAULT 0 NOT NULL,
	`monthly_fee_agorot` integer DEFAULT 0 NOT NULL,
	`june_fee_agorot` integer DEFAULT 0 NOT NULL,
	`security_check_required` integer DEFAULT true NOT NULL,
	`schedule_mode` text DEFAULT 'school_calendar' NOT NULL,
	`schedule_weekday` integer DEFAULT 3 NOT NULL,
	`schedule_start_time` text,
	`schedule_end_time` text,
	`payment_proof_required` integer DEFAULT true NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_years_slug_unique` ON `school_years` (`slug`);--> statement-breakpoint
CREATE INDEX `school_years_status_idx` ON `school_years` (`status`);--> statement-breakpoint
CREATE INDEX `school_years_dates_idx` ON `school_years` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE TABLE `signed_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`agreement_version_id` text NOT NULL,
	`pdf_file_id` text NOT NULL,
	`signature_file_id` text NOT NULL,
	`signer_name` text NOT NULL,
	`signer_role` text DEFAULT 'parent_or_guardian' NOT NULL,
	`signed_at` text NOT NULL,
	`document_hash` text NOT NULL,
	`signature_hash` text NOT NULL,
	`document_snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agreement_version_id`) REFERENCES `agreement_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`pdf_file_id`) REFERENCES `stored_files`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`signature_file_id`) REFERENCES `stored_files`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signed_agreements_registration_unique` ON `signed_agreements` (`registration_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `signed_agreements_pdf_file_unique` ON `signed_agreements` (`pdf_file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `signed_agreements_signature_file_unique` ON `signed_agreements` (`signature_file_id`);--> statement-breakpoint
CREATE INDEX `signed_agreements_version_signed_idx` ON `signed_agreements` (`agreement_version_id`,`signed_at`);--> statement-breakpoint
CREATE TABLE `stored_files` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_filename` text,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stored_files_storage_key_unique` ON `stored_files` (`storage_key`);--> statement-breakpoint
CREATE INDEX `stored_files_registration_kind_idx` ON `stored_files` (`registration_id`,`kind`);--> statement-breakpoint
CREATE INDEX `stored_files_sha256_idx` ON `stored_files` (`sha256`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`created_from_registration_id` text,
	`full_name` text NOT NULL,
	`birth_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`private_notes_ciphertext` text,
	`private_notes_iv` text,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_from_registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_created_from_registration_unique` ON `students` (`created_from_registration_id`);--> statement-breakpoint
CREATE INDEX `students_status_name_idx` ON `students` (`status`,`full_name`);--> statement-breakpoint
CREATE INDEX `students_birth_date_idx` ON `students` (`birth_date`);