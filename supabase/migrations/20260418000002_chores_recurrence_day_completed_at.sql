-- Add recurrence_day and completed_at to chores table
-- recurrence_day: stores the day context for recurring chores (e.g. "Monday", "1" for monthly)
-- completed_at: timestamp when the chore was last completed
ALTER TABLE chores
  ADD COLUMN IF NOT EXISTS recurrence_day text,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz;
