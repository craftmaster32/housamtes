-- Record which month(s) a recurring-bill payment pays for, separate from the
-- day it was paid. Stores the first covered month (always the 1st of a month);
-- the bill's frequency decides how many months follow. NULL means "the month the
-- payment was made", so existing rows keep a sensible label.
ALTER TABLE household_payments
  ADD COLUMN IF NOT EXISTS covers_from date;

-- Added NOT VALID so it doesn't scan existing rows under a table lock; every
-- existing row is NULL here anyway, and new inserts/updates are still checked.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'household_payments_covers_from_check'
  ) THEN
    ALTER TABLE household_payments
      ADD CONSTRAINT household_payments_covers_from_check
      CHECK (covers_from IS NULL OR EXTRACT(DAY FROM covers_from) = 1) NOT VALID;
  END IF;
END $$;
