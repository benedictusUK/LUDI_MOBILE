-- Nullable metadata only; existing event dates, votes and payments are untouched.
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_anchor_date date;
