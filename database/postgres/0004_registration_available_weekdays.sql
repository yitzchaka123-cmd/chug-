-- Adds the days a family said could work, for deployments that already applied 0001_initial.
-- statement-breakpoint

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "available_weekdays" text DEFAULT '' NOT NULL;
