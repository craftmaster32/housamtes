-- Calendar upgrade: multi-day events, notes, and recurrence
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence text CHECK (recurrence IN ('weekly', 'monthly', 'yearly'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_end date;

-- Enforce date-range invariants at the DB level
ALTER TABLE events ADD CONSTRAINT chk_events_end_date_ge_date
  CHECK (end_date IS NULL OR end_date >= date);
ALTER TABLE events ADD CONSTRAINT chk_events_recurrence_end_ge_date
  CHECK (recurrence_end IS NULL OR recurrence_end >= date);
