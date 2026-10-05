-- Additive only: do not rewrite existing teams or their related records.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS archived_at timestamptz;
