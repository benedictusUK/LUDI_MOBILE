-- MANUAL PRODUCTION TEST-DATA RESET -- NOT A SCHEMA MIGRATION.
-- Do not add this file to any build, startup, workflow or publishing command.
--
-- Approved scope: all teams/events and their linked disposable test records,
-- plus saved Stripe customer links. Preserve users, profiles, subscriptions,
-- Connect account links, sessions, preferences and unrelated notifications.
-- This DOES NOT cancel/refund/release/delete anything in Stripe.
--
-- 1. Back up production and pause testing before proceeding.
-- 2. Select PRODUCTION in the Database pane's SQL runner.
-- 3. Run this entire file as ONE statement (from DO through $reset$;).
--    The console manages transactions, so do not add BEGIN/COMMIT/ROLLBACK.
-- 4. Default dry run: apply_reset is false. An intentional error beginning
--    "DRY RUN PASSED" rolls back ALL changes after checking the empty state.
-- 5. After a successful dry run and backup, change ONLY apply_reset from
--    false to true and rerun the entire statement to make the reset permanent.
-- 6. If a guard fails, stop and recheck the data; do not remove the guards.

DO $reset$
DECLARE
  apply_reset boolean := false; -- KEEP FALSE FOR THE FIRST RUN.
  ledger_table text;
  users_before bigint;
  remaining_records bigint;
BEGIN
PERFORM set_config('lock_timeout', '5s', true);
PERFORM set_config('statement_timeout', '30s', true);

-- Block concurrent parent/user writes and FK-dependent inserts during reset.
LOCK TABLE public.users, public.teams, public.events IN EXCLUSIVE MODE;
LOCK TABLE public.notifications, public.event_payments, public.payments
  IN SHARE ROW EXCLUSIVE MODE;

SELECT count(*) INTO users_before FROM public.users;

  -- Abort if the inspected dataset has changed since approval.
  IF (SELECT count(*) FROM public.events) <> 416
    OR (SELECT count(*) FROM public.teams) <> 4
    OR (SELECT count(*) FROM public.event_payments) <> 2
    OR (SELECT count(*) FROM public.payments
        WHERE event_id IS NOT NULL OR team_id IS NOT NULL) <> 2
    OR (SELECT count(*) FROM public.notifications) <> 16
    OR (SELECT count(*) FROM public.users
        WHERE stripe_customer_id IS NOT NULL) <> 1
  THEN
    RAISE EXCEPTION 'Reset aborted: production counts changed; recheck before resetting';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE stripe_subscription_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Reset aborted: subscription-linked customers require separate review';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_payments
             WHERE status IS DISTINCT FROM 'hold_created')
    OR EXISTS (SELECT 1 FROM public.payments
               WHERE (event_id IS NOT NULL OR team_id IS NOT NULL)
                 AND status IS DISTINCT FROM 'authorized')
  THEN
    RAISE EXCEPTION 'Reset aborted: payment states changed; recheck before resetting';
  END IF;

-- Notifications have no FK to events/teams. Remove linked messages and the
-- known event/team test-notification types, including demo/stale references.
-- PostgreSQL 16 validity checking avoids casting malformed metadata.
DELETE FROM public.notifications n
WHERE n.related_id IN (
  SELECT id FROM public.events
  UNION SELECT id FROM public.teams
  UNION SELECT id FROM public.team_invitations
)
OR n.type IN (
  'event_changed', 'flare_gun', 'new_event',
  'payment_authorization_required', 'reserve_promotion',
  'team_invitation', 'team_join_approved', 'team_join_rejected',
  'team_join_request'
)
OR (
  CASE WHEN pg_input_is_valid(n.metadata, 'jsonb')
    THEN n.metadata::jsonb ELSE '{}'::jsonb END
) ?| ARRAY['eventId', 'teamId', 'event_id', 'team_id', 'eventData', 'teamData'];

-- New payment-accounting tables may not exist until the pending Publish
-- schema update is applied. If present, remove linked test ledger records
-- explicitly because these three tables restrict deletion of their parent.
  FOREACH ledger_table IN ARRAY ARRAY[
    'payment_refunds', 'payment_transfers', 'payment_disputes'
  ]
  LOOP
    IF to_regclass(format('public.%I', ledger_table)) IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE event_payment_id IN
          (SELECT id FROM public.event_payments)',
        ledger_table
      );
    END IF;
  END LOOP;

-- Cascades remove event attendance, activity/payment audit records,
-- reimbursements, event payments, event/team-linked payments, event-team
-- links, flare responses, followed events, memberships, invitations and blocks.
-- Events go first because their primary_team_id FK does not cascade.
DELETE FROM public.events;
DELETE FROM public.teams;

-- Preserve every user and all other profile/billing/Connect fields.
UPDATE public.users
SET stripe_customer_id = NULL
WHERE stripe_customer_id IS NOT NULL;

-- Assert the empty state before allowing either dry-run success or commit.
SELECT
  (SELECT count(*) FROM public.events) +
  (SELECT count(*) FROM public.teams) +
  (SELECT count(*) FROM public.event_attendance) +
  (SELECT count(*) FROM public.event_payments) +
  (SELECT count(*) FROM public.event_teams) +
  (SELECT count(*) FROM public.team_memberships) +
  (SELECT count(*) FROM public.payments
    WHERE event_id IS NOT NULL OR team_id IS NOT NULL) +
  (SELECT count(*) FROM public.users
    WHERE stripe_customer_id IS NOT NULL)
INTO remaining_records;

IF remaining_records <> 0
  OR (SELECT count(*) FROM public.users) <> users_before
THEN
  RAISE EXCEPTION 'Reset aborted: verification failed; all changes rolled back';
END IF;

IF NOT apply_reset THEN
  -- A failed PostgreSQL statement is atomic: every preceding change in this
  -- DO block is rolled back, even when the console auto-manages transactions.
  RAISE EXCEPTION
    'DRY RUN PASSED: reset verified, users preserved, all changes rolled back. Nothing permanently deleted. After backup, set apply_reset to true and rerun.';
END IF;

RAISE NOTICE 'RESET COMPLETE: events, teams, linked test records and saved customer links cleared; users preserved';
END
$reset$;