-- A minimum attendance condition is orthogonal to how the price is calculated.
-- Preserve existing fixed-threshold events as fixed-price events with their
-- existing minimum_paid_participants value, then remove the redundant policy.
UPDATE "events"
SET "payment_policy" = 'fixed_immediate'
WHERE "payment_policy" = 'fixed_threshold';

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_payment_policy_check";
ALTER TABLE "events" ADD CONSTRAINT "events_payment_policy_check"
  CHECK ("payment_policy" IN ('none', 'fixed_immediate', 'flexible_post_event'));

COMMENT ON COLUMN "events"."minimum_paid_participants" IS
  'Optional attendance floor for either fixed_immediate or flexible_post_event payment policies';
