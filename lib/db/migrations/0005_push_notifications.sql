CREATE TABLE platform_admins (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_triggers (
  id varchar PRIMARY KEY,
  template_id varchar NOT NULL REFERENCES push_templates(id),
  enabled boolean NOT NULL DEFAULT true,
  audience varchar NOT NULL DEFAULT 'existing' CHECK (audience IN ('existing','attendees','team_members')),
  reminder_minutes integer NOT NULL DEFAULT 1440 CHECK (reminder_minutes BETWEEN 5 AND 10080),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_devices (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id varchar NOT NULL,
  token text NOT NULL,
  environment varchar NOT NULL CHECK (environment IN ('sandbox','production')),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token, environment)
);
CREATE INDEX push_devices_user_idx ON push_devices(user_id);
CREATE TABLE push_deliveries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id varchar NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id varchar REFERENCES notifications(id) ON DELETE SET NULL,
  trigger_id varchar NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL,
  status varchar NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','retry','sending','accepted','failed','expired','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  reason text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_deliveries_pending_idx ON push_deliveries(status, next_attempt_at);
CREATE TABLE push_reminder_claims (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_admin_audit (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Every notification writer (including legacy bulk flare inserts) participates
-- in the same durable outbox. Existing historical notifications are not replayed.
CREATE TABLE push_notification_outbox (
  notification_id varchar PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION ludi_queue_notification_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO push_notification_outbox (notification_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notification_push_outbox AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION ludi_queue_notification_push();

-- Payment state transitions are recorded by both checkout and Stripe webhook
-- paths. Generate each notice on the actual state change, not on a client click.
CREATE FUNCTION ludi_notify_payment_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text;
DECLARE event_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payment_intent_status IS NOT DISTINCT FROM OLD.payment_intent_status
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'captured' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'captured') THEN
    kind := 'payment_captured';
  ELSIF NEW.payment_intent_status = 'requires_payment_method' AND NEW.payment_intent_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.payment_intent_status IS DISTINCT FROM 'requires_payment_method') THEN
    kind := 'payment_failed';
  ELSE RETURN NEW;
  END IF;
  SELECT name INTO event_name FROM events WHERE id = NEW.event_id;
  INSERT INTO notifications (user_id, title, message, type, related_id, metadata)
  VALUES (NEW.user_id,
    CASE WHEN kind = 'payment_captured' THEN 'Payment collected' ELSE 'Payment needs attention' END,
    CASE WHEN kind = 'payment_captured' THEN 'Your payment for "' || coalesce(event_name, 'your event') || '" has been collected.'
      ELSE 'Please review your payment method for "' || coalesce(event_name, 'your event') || '" in LUDI.' END,
    kind, NEW.event_id, json_build_object('eventId', NEW.event_id, 'amountMinor', NEW.captured_amount_minor)::text);
  RETURN NEW;
END;
$$;
CREATE TRIGGER event_payment_notification AFTER INSERT OR UPDATE OF status, payment_intent_status ON event_payments
FOR EACH ROW EXECUTE FUNCTION ludi_notify_payment_state();

INSERT INTO push_templates (id, name, title, body) VALUES
('default:event_created', 'New event', 'New event: {eventName}', '{teamName} has a new event on {startDate} at {startTime}. Tap to see the details.'),
('default:event_changed', 'Event changed', 'Update: {eventName}', 'The details for {eventName} have changed. Tap to check the latest information.'),
('default:event_cancelled', 'Event cancelled', 'Event cancelled: {eventName}', '{eventName} has been cancelled. Open LUDI for more information.'),
('default:flare_gun', 'Flare', 'Players needed: {eventName}', '{teamName} needs players at {location}. Tap to view the event.'),
('default:event_reminder', 'Event reminder', 'Coming up: {eventName}', '{eventName} starts at {startTime} on {startDate}. Location: {location}.'),
('default:payment_reminder', 'Payment reminder', 'Payment reminder: {eventName}', 'There is a payment or authorisation to complete for {eventName}. Tap to review the payment details.'),
('default:payment_required', 'Payment required', 'Payment required: {eventName}', '{message}'),
('default:payment_authorization_required', 'Authorisation required', 'Authorisation needed: {eventName}', '{message}'),
('default:payment_captured', 'Payment collected', 'Payment update: {eventName}', '{message}'),
('default:payment_failed', 'Payment failed', 'Payment needs attention: {eventName}', '{message}');
INSERT INTO push_triggers (id, template_id, enabled, audience)
SELECT substring(id from 9), id,
  id NOT IN ('default:event_reminder','default:payment_reminder'),
  CASE WHEN id = 'default:event_reminder' THEN 'attendees' ELSE 'existing' END
FROM push_templates WHERE id LIKE 'default:%';