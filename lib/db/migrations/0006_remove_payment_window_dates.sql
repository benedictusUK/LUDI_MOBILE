ALTER TABLE "events"
  DROP COLUMN IF EXISTS "authorization_opens_at",
  DROP COLUMN IF EXISTS "payment_deadline_at";
