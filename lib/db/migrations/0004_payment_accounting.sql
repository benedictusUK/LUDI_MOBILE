ALTER TABLE "event_payments"
  ADD COLUMN IF NOT EXISTS "stripe_charge_id" varchar,
  ADD COLUMN IF NOT EXISTS "stripe_balance_transaction_id" varchar,
  ADD COLUMN IF NOT EXISTS "agreed_amount_minor" integer,
  ADD COLUMN IF NOT EXISTS "authorized_amount_minor" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "captured_amount_minor" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refunded_amount_minor" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "platform_fee_minor" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "organiser_amount_minor" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "stripe_fee_minor" integer,
  ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'gbp' NOT NULL,
  ADD COLUMN IF NOT EXISTS "capture_deadline_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "event_payments_payment_intent_unique"
  ON "event_payments" ("payment_intent_id") WHERE "payment_intent_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "event_payments_charge_unique"
  ON "event_payments" ("stripe_charge_id") WHERE "stripe_charge_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "payment_operations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "event_payment_id" varchar REFERENCES "event_payments"("id") ON DELETE CASCADE,
  "event_id" varchar REFERENCES "events"("id") ON DELETE CASCADE, "operation_key" varchar UNIQUE NOT NULL,
  "kind" varchar NOT NULL, "status" varchar DEFAULT 'pending' NOT NULL, "stripe_idempotency_key" varchar UNIQUE NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL, "last_error" text, "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL, "completed_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "event_payment_id" varchar NOT NULL REFERENCES "event_payments"("id") ON DELETE RESTRICT,
  "stripe_refund_id" varchar UNIQUE, "request_key" varchar UNIQUE NOT NULL, "amount_minor" integer NOT NULL,
  "currency" varchar(3) NOT NULL, "status" varchar NOT NULL, "reason" varchar, "reverse_transfer" boolean DEFAULT true NOT NULL,
  "refund_application_fee" boolean DEFAULT false NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_transfers" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "event_payment_id" varchar NOT NULL REFERENCES "event_payments"("id") ON DELETE RESTRICT,
  "stripe_transfer_id" varchar UNIQUE NOT NULL, "destination_account_id" varchar NOT NULL, "amount_minor" integer NOT NULL,
  "reversed_amount_minor" integer DEFAULT 0 NOT NULL, "currency" varchar(3) NOT NULL, "status" varchar NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_disputes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "event_payment_id" varchar NOT NULL REFERENCES "event_payments"("id") ON DELETE RESTRICT,
  "stripe_dispute_id" varchar UNIQUE NOT NULL, "stripe_charge_id" varchar NOT NULL, "amount_minor" integer NOT NULL,
  "currency" varchar(3) NOT NULL, "status" varchar NOT NULL, "reason" varchar, "evidence_due_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
