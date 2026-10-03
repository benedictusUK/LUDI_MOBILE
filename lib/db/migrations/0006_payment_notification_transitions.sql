-- Only genuine payment-state transitions generate a push. A newly created
-- Stripe intent's normal requires_payment_method state is not a card decline.
CREATE OR REPLACE FUNCTION ludi_notify_payment_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text;
DECLARE event_name text;
DECLARE event_policy text;
DECLARE heading text;
DECLARE notice text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payment_intent_status IS NOT DISTINCT FROM OLD.payment_intent_status
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT name, payment_policy INTO event_name, event_policy FROM events WHERE id = NEW.event_id;
  event_name := coalesce(event_name, 'your event');
  IF NEW.status = 'captured' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'captured') THEN
    kind := 'payment_captured';
    heading := 'Payment collected';
    notice := 'Your payment for "' || event_name || '" has been collected.';
  ELSIF TG_OP = 'UPDATE' AND NEW.payment_intent_status = 'requires_payment_method'
    AND OLD.payment_intent_status IN ('requires_confirmation','requires_action','processing','requires_capture') THEN
    kind := 'payment_failed';
    heading := 'Payment needs attention';
    notice := 'Please review your payment method for "' || event_name || '" in LUDI.';
  ELSIF NEW.payment_intent_status = 'requires_action'
    AND (TG_OP = 'INSERT' OR OLD.payment_intent_status IS DISTINCT FROM 'requires_action') THEN
    kind := 'payment_authorization_required';
    heading := 'Payment authorisation required';
    notice := 'Please complete your bank authorisation for "' || event_name || '" in LUDI.';
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'setup_pending' THEN
    IF event_policy = 'flexible_post_event' THEN
      kind := 'payment_authorization_required';
      heading := 'Payment authorisation required';
      notice := 'Please complete payment authorisation for "' || event_name || '" in LUDI.';
    ELSE
      kind := 'payment_required';
      heading := 'Payment required';
      notice := 'Please complete your event payment for "' || event_name || '" in LUDI.';
    END IF;
  ELSE RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, title, message, type, related_id, metadata)
  VALUES (NEW.user_id, heading, notice, kind, NEW.event_id,
    json_build_object('eventId', NEW.event_id,
      'amountMinor', CASE WHEN kind = 'payment_captured' THEN NEW.captured_amount_minor ELSE NEW.agreed_amount_minor END)::text);
  RETURN NEW;
END;
$$;