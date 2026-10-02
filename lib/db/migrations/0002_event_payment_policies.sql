ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "payment_policy" varchar DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'gbp' NOT NULL,
  ADD COLUMN IF NOT EXISTS "fixed_price_minor" integer,
  ADD COLUMN IF NOT EXISTS "minimum_paid_participants" integer,
  ADD COLUMN IF NOT EXISTS "payment_deadline_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "authorization_opens_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "completion_due_at" timestamp with time zone;

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_payment_policy_check";
ALTER TABLE "events" ADD CONSTRAINT "events_payment_policy_check"
  CHECK ("payment_policy" IN ('none', 'fixed_threshold', 'fixed_immediate', 'flexible_post_event'));

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_currency_check";
ALTER TABLE "events" ADD CONSTRAINT "events_currency_check"
  CHECK ("currency" ~ '^[a-z]{3}$');

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_fixed_price_minor_check";
ALTER TABLE "events" ADD CONSTRAINT "events_fixed_price_minor_check"
  CHECK ("fixed_price_minor" IS NULL OR "fixed_price_minor" > 0);

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_minimum_paid_participants_check";
ALTER TABLE "events" ADD CONSTRAINT "events_minimum_paid_participants_check"
  CHECK ("minimum_paid_participants" IS NULL OR "minimum_paid_participants" > 0);

UPDATE "events"
SET "payment_policy" = CASE
  WHEN "payment_required" IS TRUE THEN 'flexible_post_event'
  ELSE 'none'
END
WHERE "payment_policy" = 'none';
