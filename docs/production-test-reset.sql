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
-- 3. Run this entire file as one batch. Its default ending is ROLLBACK:
--    the verification result shows the proposed empty state, then undoes it.
-- 4. If the dry run succeeds, replace ONLY the final ROLLBACK with COMMIT
--    and run the entire batch again to make the reset permanent.
-- 5. If a guard fails, stop and recheck the data; do not remove the guards.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Block concurrent parent/user writes and FK-dependent inserts during reset.
LOCK TABLE public.users, public.teams, public.events IN EXCLUSIVE MODE;
LOCK TABLE public.notifications, public.event_payments, public.payments
  IN SHARE ROW EXCLUSIVE MODE;

DO $reset_guard$
BEGIN
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
END
$reset_guard$;

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
DO $linked_ledger$
DECLARE
  ledger_table text;
BEGIN
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
END
$linked_ledger$;

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

-- All columns in this verification result must be zero.
SELECT
  (SELECT count(*) FROM public.events) AS events_remaining,
  (SELECT count(*) FROM public.teams) AS teams_remaining,
  (SELECT count(*) FROM public.event_attendance) AS attendance_remaining,
  (SELECT count(*) FROM public.event_payments) AS event_payments_remaining,
  (SELECT count(*) FROM public.event_teams) AS event_team_links_remaining,
  (SELECT count(*) FROM public.team_memberships) AS memberships_remaining,
  (SELECT count(*) FROM public.payments
    WHERE event_id IS NOT NULL OR team_id IS NOT NULL) AS linked_payments_remaining,
  (SELECT count(*) FROM public.users
    WHERE stripe_customer_id IS NOT NULL) AS saved_customers_remaining;

-- DRY RUN DEFAULT. Replace this line with COMMIT; only after backup/review.
ROLLBACK;