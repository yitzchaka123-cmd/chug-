-- Adds the per-method cash-handling flag for deployments that already applied 0001_initial.
-- statement-breakpoint

ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "cash_handling" integer DEFAULT 0 NOT NULL;

-- statement-breakpoint

UPDATE "payment_methods" SET "cash_handling" = 1 WHERE "code" = 'cash';
