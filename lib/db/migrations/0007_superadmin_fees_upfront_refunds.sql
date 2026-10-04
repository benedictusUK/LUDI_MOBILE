CREATE TABLE IF NOT EXISTS platform_fee_settings (
  id varchar PRIMARY KEY CHECK (id = 'default'),
  platform_basis_points integer NOT NULL CHECK (platform_basis_points BETWEEN 0 AND 10000),
  stripe_basis_points integer NOT NULL CHECK (stripe_basis_points BETWEEN 0 AND 10000),
  stripe_fixed_minor integer NOT NULL CHECK (stripe_fixed_minor BETWEEN 0 AND 1000000),
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_fee_audit (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  before jsonb NOT NULL,
  after jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS fee_configuration jsonb;
ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS settled_base_amount_minor integer;