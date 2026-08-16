-- Adds the group announcements history table for deployments that already applied earlier migrations.
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_announcements" (
  "id" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL,
  "title" text,
  "body" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "group_announcements" ADD CONSTRAINT "group_announcements_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS "group_announcements_group_created_idx" ON "group_announcements" ("group_id", "created_at");
