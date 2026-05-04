-- Add optional next_due_date to recurring_bills so a due date can be set
-- when creating a bill before any payments have been logged.
ALTER TABLE recurring_bills
  ADD COLUMN IF NOT EXISTS next_due_date DATE;
