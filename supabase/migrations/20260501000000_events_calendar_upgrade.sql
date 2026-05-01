-- Calendar upgrade: multi-day events, notes, and recurrence
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence text CHECK (recurrence IN ('weekly', 'monthly', 'yearly'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_end date;
