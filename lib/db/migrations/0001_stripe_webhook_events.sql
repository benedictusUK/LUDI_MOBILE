CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "stripe_event_id" varchar PRIMARY KEY NOT NULL,
  "type" varchar(255) NOT NULL,
  "object_id" varchar,
  "account_id" varchar,
  "api_version" varchar,
  "livemode" boolean NOT NULL,
  "status" varchar DEFAULT 'received' NOT NULL,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "last_error" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stripe_webhook_events_status_check"
    CHECK ("status" IN ('received', 'processing', 'processed', 'failed'))
);

CREATE INDEX IF NOT EXISTS "IDX_stripe_webhook_status_updated"
  ON "stripe_webhook_events" ("status", "updated_at");

CREATE INDEX IF NOT EXISTS "IDX_stripe_webhook_type_received"
  ON "stripe_webhook_events" ("type", "received_at");
