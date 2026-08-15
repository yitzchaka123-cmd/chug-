-- The Choir Chug PostgreSQL schema;

-- Generated from the checked-in Cloudflare/SQLite migrations.;

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "admin_user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "ip_hash" text,
  "user_agent_hash" text,
  "last_seen_at" text NOT NULL,
  "expires_at" text NOT NULL,
  "revoked_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text,
  "display_name" text DEFAULT 'Administrator' NOT NULL,
  "passcode_hash" text NOT NULL,
  "passcode_salt" text NOT NULL,
  "passcode_updated_at" text NOT NULL,
  "recovery_email" text,
  "recovery_email_verified" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "agreement_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text NOT NULL,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "sections_json" text NOT NULL,
  "content_hash" text NOT NULL,
  "is_active" integer DEFAULT 0 NOT NULL,
  "effective_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "school_year_id" text,
  "actor_type" text NOT NULL,
  "actor_id" text,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "summary" text,
  "changes_json" text DEFAULT '{}' NOT NULL,
  "ip_hash" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "auth_attempts" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "identifier_hash" text NOT NULL,
  "failures" integer DEFAULT 0 NOT NULL,
  "first_failure_at" text,
  "last_failure_at" text,
  "blocked_until" text,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "enrollments" (
  "id" text PRIMARY KEY NOT NULL,
  "student_id" text NOT NULL,
  "school_year_id" text NOT NULL,
  "registration_id" text,
  "status" text DEFAULT 'active' NOT NULL,
  "group_label" text,
  "registration_fee_agorot" integer DEFAULT 0 NOT NULL,
  "monthly_fee_agorot" integer DEFAULT 0 NOT NULL,
  "june_fee_agorot" integer DEFAULT 0 NOT NULL,
  "security_check_agorot" integer DEFAULT 0 NOT NULL,
  "enrolled_at" text NOT NULL,
  "left_at" text,
  "archive_reason" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "payment_items" (
  "id" text PRIMARY KEY NOT NULL,
  "enrollment_id" text NOT NULL,
  "school_year_id" text NOT NULL,
  "registration_id" text,
  "proof_file_id" text,
  "period_key" text NOT NULL,
  "label" text NOT NULL,
  "due_on" text,
  "amount_due_agorot" integer NOT NULL,
  "amount_paid_agorot" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'unpaid' NOT NULL,
  "method" text,
  "marked_paid_at" text,
  "marked_paid_by" text,
  "notes" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "registration_section_approvals" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "registration_id" text NOT NULL,
  "agreement_version_id" text NOT NULL,
  "section_key" text NOT NULL,
  "section_title" text NOT NULL,
  "section_hash" text NOT NULL,
  "approved" integer DEFAULT 0 NOT NULL,
  "approved_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "registrations" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text NOT NULL,
  "agreement_version_id" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "participant_full_name" text NOT NULL,
  "participant_birth_date" text,
  "father_name" text,
  "father_phone" text,
  "father_email" text,
  "mother_name" text,
  "mother_phone" text,
  "mother_email" text,
  "emergency_contact_name" text,
  "emergency_contact_phone" text,
  "emergency_contact_relation" text,
  "medical_information_ciphertext" text,
  "medical_information_iv" text,
  "payment_method" text,
  "registration_fee_agorot" integer DEFAULT 0 NOT NULL,
  "monthly_fee_agorot" integer DEFAULT 0 NOT NULL,
  "june_fee_agorot" integer DEFAULT 0 NOT NULL,
  "security_check_agorot" integer DEFAULT 0 NOT NULL,
  "payment_proof_status" text DEFAULT 'not_required' NOT NULL,
  "payment_status" text DEFAULT 'pending' NOT NULL,
  "pricing_snapshot_json" text DEFAULT '{}' NOT NULL,
  "form_snapshot_json" text DEFAULT '{}' NOT NULL,
  "draft_token_hash" text,
  "download_token_hash" text,
  "submitted_at" text,
  "completed_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "school_years" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "starts_on" text NOT NULL,
  "ends_on" text NOT NULL,
  "currency" text DEFAULT 'ILS' NOT NULL,
  "registration_fee_agorot" integer DEFAULT 0 NOT NULL,
  "monthly_fee_agorot" integer DEFAULT 0 NOT NULL,
  "june_fee_agorot" integer DEFAULT 0 NOT NULL,
  "security_check_required" integer DEFAULT 1 NOT NULL,
  "schedule_mode" text DEFAULT 'school_calendar' NOT NULL,
  "schedule_weekday" integer DEFAULT 3 NOT NULL,
  "schedule_start_time" text,
  "schedule_end_time" text,
  "payment_proof_required" integer DEFAULT 1 NOT NULL,
  "settings_json" text DEFAULT '{}' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "signed_agreements" (
  "id" text PRIMARY KEY NOT NULL,
  "registration_id" text NOT NULL,
  "agreement_version_id" text NOT NULL,
  "pdf_file_id" text NOT NULL,
  "signature_file_id" text NOT NULL,
  "signer_name" text NOT NULL,
  "signer_role" text DEFAULT 'parent_or_guardian' NOT NULL,
  "signed_at" text NOT NULL,
  "document_hash" text NOT NULL,
  "signature_hash" text NOT NULL,
  "document_snapshot_json" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "stored_files" (
  "id" text PRIMARY KEY NOT NULL,
  "registration_id" text,
  "kind" text NOT NULL,
  "storage_key" text NOT NULL,
  "original_filename" text,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "sha256" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "uploaded_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "students" (
  "id" text PRIMARY KEY NOT NULL,
  "created_from_registration_id" text,
  "full_name" text NOT NULL,
  "birth_date" text,
  "status" text DEFAULT 'active' NOT NULL,
  "private_notes_ciphertext" text,
  "private_notes_iv" text,
  "archived_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "backup_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "storage_key" text NOT NULL,
  "sha256" text NOT NULL,
  "byte_size" integer NOT NULL,
  "reason" text DEFAULT 'automatic' NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "created_by" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "brand_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text DEFAULT 'logo' NOT NULL,
  "name" text NOT NULL,
  "stored_file_id" text NOT NULL,
  "is_current" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_by" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "creative_prompts" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "style" text,
  "facts_json" text DEFAULT '{}' NOT NULL,
  "prompt_text" text NOT NULL,
  "created_by" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "custom_registration_links" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text NOT NULL,
  "group_id" text,
  "label" text NOT NULL,
  "token_hash" text NOT NULL,
  "token_ciphertext" text NOT NULL,
  "registration_fee_agorot" integer,
  "monthly_fee_agorot" integer,
  "june_fee_agorot" integer,
  "security_check_agorot" integer,
  "one_time_amount_agorot" integer,
  "month_overrides_json" text DEFAULT '{}' NOT NULL,
  "allowed_payment_method" text,
  "proof_policy" text,
  "private_note_ciphertext" text,
  "status" text DEFAULT 'active' NOT NULL,
  "max_uses" integer,
  "use_count" integer DEFAULT 0 NOT NULL,
  "expires_at" text,
  "disabled_at" text,
  "created_by" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "registration_id" text,
  "recipient_hash" text NOT NULL,
  "recipient_ciphertext" text NOT NULL,
  "message_ciphertext" text NOT NULL,
  "template" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "provider_message_id" text,
  "last_error" text,
  "sent_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "groups" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text NOT NULL,
  "name" text NOT NULL,
  "age_min" integer,
  "age_max" integer,
  "weekday" integer DEFAULT 3 NOT NULL,
  "start_time" text,
  "end_time" text,
  "session_length_minutes" integer DEFAULT 50 NOT NULL,
  "location" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "announcement_title" text,
  "announcement_body" text,
  "announcement_updated_at" text,
  "share_token_hash" text,
  "share_token_ciphertext" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text NOT NULL,
  "code" text NOT NULL,
  "label" text NOT NULL,
  "instructions" text DEFAULT '' NOT NULL,
  "proof_policy" text DEFAULT 'optional' NOT NULL,
  "enabled" integer DEFAULT 1 NOT NULL,
  "is_default" integer DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "saved_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text,
  "group_id" text,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "page_size" text DEFAULT 'A4' NOT NULL,
  "content_json" text NOT NULL,
  "created_by" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "schedule_events" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text NOT NULL,
  "group_id" text,
  "kind" text DEFAULT 'session' NOT NULL,
  "title_en" text DEFAULT 'Choir session' NOT NULL,
  "title_he" text,
  "starts_at" text NOT NULL,
  "ends_at" text,
  "location" text,
  "note" text,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "source_key" text,
  "created_by" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "schedule_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "school_year_id" text NOT NULL,
  "version" integer NOT NULL,
  "name" text NOT NULL,
  "scope_json" text DEFAULT '{}' NOT NULL,
  "snapshot_json" text NOT NULL,
  "status" text DEFAULT 'finalized' NOT NULL,
  "finalized_by" text,
  "finalized_at" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

CREATE TABLE IF NOT EXISTS "admin_recovery_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "admin_user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "purpose" text DEFAULT 'passcode_reset' NOT NULL,
  "expires_at" text NOT NULL,
  "consumed_at" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint;

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "group_id" text;

-- statement-breakpoint;

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "schedule_token_hash" text;

-- statement-breakpoint;

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "schedule_token_ciphertext" text;

-- statement-breakpoint;

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "custom_registration_link_id" text;

-- statement-breakpoint;

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'awaiting_review' NOT NULL;

-- statement-breakpoint;

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "approved_at" text;

-- statement-breakpoint;

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "approved_by" text;

-- statement-breakpoint;

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "draft_expires_at" text;

-- statement-breakpoint;

ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_proof_file_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "stored_files"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "registration_section_approvals" ADD CONSTRAINT "registration_section_approvals_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "registration_section_approvals" ADD CONSTRAINT "registration_section_approvals_agreement_version_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "agreement_versions"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_agreement_version_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "agreement_versions"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "signed_agreements" ADD CONSTRAINT "signed_agreements_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "signed_agreements" ADD CONSTRAINT "signed_agreements_agreement_version_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "agreement_versions"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "signed_agreements" ADD CONSTRAINT "signed_agreements_pdf_file_id_fk" FOREIGN KEY ("pdf_file_id") REFERENCES "stored_files"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "signed_agreements" ADD CONSTRAINT "signed_agreements_signature_file_id_fk" FOREIGN KEY ("signature_file_id") REFERENCES "stored_files"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "students" ADD CONSTRAINT "students_created_from_registration_id_fk" FOREIGN KEY ("created_from_registration_id") REFERENCES "registrations"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_stored_file_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

-- statement-breakpoint;

ALTER TABLE "creative_prompts" ADD CONSTRAINT "creative_prompts_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "custom_registration_links" ADD CONSTRAINT "custom_registration_links_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "custom_registration_links" ADD CONSTRAINT "custom_registration_links_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "groups" ADD CONSTRAINT "groups_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- statement-breakpoint;

ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

-- statement-breakpoint;

ALTER TABLE "admin_recovery_tokens" ADD CONSTRAINT "admin_recovery_tokens_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "admin_sessions_token_hash_unique" ON "admin_sessions" ("token_hash");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "admin_sessions_user_expires_idx" ON "admin_sessions" ("admin_user_id","expires_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "admin_sessions_expires_revoked_idx" ON "admin_sessions" ("expires_at","revoked_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_unique" ON "admin_users" ("email");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "admin_users_status_idx" ON "admin_users" ("status");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "agreement_versions_year_version_unique" ON "agreement_versions" ("school_year_id","version");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "agreement_versions_year_active_idx" ON "agreement_versions" ("school_year_id","is_active");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "agreement_versions_content_hash_idx" ON "agreement_versions" ("content_hash");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "audit_log_entity_created_idx" ON "audit_log" ("entity_type","entity_id","created_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "audit_log_actor_created_idx" ON "audit_log" ("actor_type","actor_id","created_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "audit_log_year_created_idx" ON "audit_log" ("school_year_id","created_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "auth_attempts_identifier_hash_unique" ON "auth_attempts" ("identifier_hash");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "auth_attempts_blocked_until_idx" ON "auth_attempts" ("blocked_until");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_student_year_unique" ON "enrollments" ("student_id","school_year_id");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_registration_unique" ON "enrollments" ("registration_id");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "enrollments_year_status_idx" ON "enrollments" ("school_year_id","status");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "enrollments_year_group_idx" ON "enrollments" ("school_year_id","group_label");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_items_enrollment_period_unique" ON "payment_items" ("enrollment_id","period_key");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "payment_items_year_status_due_idx" ON "payment_items" ("school_year_id","status","due_on");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "payment_items_registration_idx" ON "payment_items" ("registration_id");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "registration_section_approvals_registration_section_unique" ON "registration_section_approvals" ("registration_id","section_key");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "registration_section_approvals_agreement_idx" ON "registration_section_approvals" ("agreement_version_id");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "registrations_year_status_idx" ON "registrations" ("school_year_id","status");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "registrations_participant_name_idx" ON "registrations" ("participant_full_name");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "registrations_submitted_at_idx" ON "registrations" ("submitted_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "registrations_draft_token_hash_unique" ON "registrations" ("draft_token_hash");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "registrations_download_token_hash_unique" ON "registrations" ("download_token_hash");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "school_years_slug_unique" ON "school_years" ("slug");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "school_years_status_idx" ON "school_years" ("status");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "school_years_dates_idx" ON "school_years" ("starts_on","ends_on");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "signed_agreements_registration_unique" ON "signed_agreements" ("registration_id");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "signed_agreements_pdf_file_unique" ON "signed_agreements" ("pdf_file_id");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "signed_agreements_signature_file_unique" ON "signed_agreements" ("signature_file_id");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "signed_agreements_version_signed_idx" ON "signed_agreements" ("agreement_version_id","signed_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "stored_files_storage_key_unique" ON "stored_files" ("storage_key");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "stored_files_registration_kind_idx" ON "stored_files" ("registration_id","kind");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "stored_files_sha256_idx" ON "stored_files" ("sha256");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "students_created_from_registration_unique" ON "students" ("created_from_registration_id");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "students_status_name_idx" ON "students" ("status","full_name");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "students_birth_date_idx" ON "students" ("birth_date");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "backup_snapshots_storage_key_unique" ON "backup_snapshots" ("storage_key");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "backup_snapshots_created_idx" ON "backup_snapshots" ("created_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "brand_assets_kind_current_idx" ON "brand_assets" ("kind","is_current","status");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "creative_prompts_year_kind_idx" ON "creative_prompts" ("school_year_id","kind");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "creative_prompts_updated_idx" ON "creative_prompts" ("updated_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "custom_registration_links_token_hash_unique" ON "custom_registration_links" ("token_hash");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "custom_registration_links_year_status_idx" ON "custom_registration_links" ("school_year_id","status");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "custom_registration_links_group_idx" ON "custom_registration_links" ("group_id");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_dedupe_key_unique" ON "email_outbox" ("dedupe_key");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "email_outbox_status_created_idx" ON "email_outbox" ("status","created_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "email_outbox_registration_idx" ON "email_outbox" ("registration_id");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "email_outbox_recipient_created_idx" ON "email_outbox" ("recipient_hash","created_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "groups_year_name_unique" ON "groups" ("school_year_id","name");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "groups_share_token_hash_unique" ON "groups" ("share_token_hash");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "groups_year_status_idx" ON "groups" ("school_year_id","status");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_year_code_unique" ON "payment_methods" ("school_year_id","code");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "payment_methods_year_enabled_sort_idx" ON "payment_methods" ("school_year_id","enabled","sort_order");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "saved_documents_year_kind_idx" ON "saved_documents" ("school_year_id","kind");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "saved_documents_group_kind_idx" ON "saved_documents" ("group_id","kind");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "schedule_events_group_source_key_unique" ON "schedule_events" ("group_id","source_key");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "schedule_events_year_start_idx" ON "schedule_events" ("school_year_id","starts_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "schedule_events_group_start_idx" ON "schedule_events" ("group_id","starts_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "schedule_events_group_status_idx" ON "schedule_events" ("group_id","status");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "schedule_versions_year_version_unique" ON "schedule_versions" ("school_year_id","version");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "schedule_versions_year_finalized_idx" ON "schedule_versions" ("school_year_id","finalized_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_schedule_token_hash_unique" ON "enrollments" ("schedule_token_hash");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "enrollments_group_status_idx" ON "enrollments" ("group_id","status");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "registrations_year_review_idx" ON "registrations" ("school_year_id","review_status");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "registrations_custom_link_idx" ON "registrations" ("custom_registration_link_id");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "registrations_draft_expiry_idx" ON "registrations" ("status","draft_expires_at");

-- statement-breakpoint;

CREATE UNIQUE INDEX IF NOT EXISTS "admin_recovery_tokens_hash_unique" ON "admin_recovery_tokens" ("token_hash");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "admin_recovery_tokens_user_expiry_idx" ON "admin_recovery_tokens" ("admin_user_id","expires_at");

-- statement-breakpoint;

CREATE INDEX IF NOT EXISTS "admin_recovery_tokens_expiry_consumed_idx" ON "admin_recovery_tokens" ("expires_at","consumed_at");

-- statement-breakpoint;
