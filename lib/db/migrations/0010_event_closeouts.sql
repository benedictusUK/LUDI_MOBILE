CREATE TABLE IF NOT EXISTS event_closeouts (
  event_id varchar PRIMARY KEY REFERENCES events(id) ON DELETE RESTRICT,
  venue_cost_minor integer NOT NULL CHECK (venue_cost_minor >= 0),
  players jsonb NOT NULL, status varchar NOT NULL DEFAULT 'draft',
  transfer_plan jsonb NOT NULL DEFAULT '[]', payout_minor integer,
  destination_account_id varchar, acknowledged_by varchar REFERENCES users(id),
  acknowledged_at timestamptz, last_error varchar, closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_closeout_links (
  id varchar PRIMARY KEY, event_id varchar NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id varchar NOT NULL REFERENCES users(id), checkout_session_id varchar UNIQUE,
  checkout_url varchar, base_amount_minor integer NOT NULL CHECK (base_amount_minor > 0),
  total_amount_minor integer NOT NULL CHECK (total_amount_minor >= base_amount_minor),
  status varchar NOT NULL, payment_intent_id varchar, charge_id varchar,
  refunded_amount_minor integer NOT NULL DEFAULT 0, refund_id varchar,
  refund_pending boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_closeout_refunds (
  id varchar PRIMARY KEY, event_id varchar NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  source_key varchar NOT NULL, payment_intent_id varchar NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  target_refund_minor integer NOT NULL CHECK (target_refund_minor > 0),
  stripe_refund_id varchar, status varchar NOT NULL DEFAULT 'pending', error varchar
);
