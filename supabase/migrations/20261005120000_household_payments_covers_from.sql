-- Record which month(s) a recurring-bill payment pays for, separate from the
-- day it was paid. Stores the first covered month (always the 1st of a month);
-- the bill's frequency decides how many months follow. NULL means "the month the
-- payment was made", so existing rows keep a sensible label.
ALTER TABLE household_payments
  ADD COLUMN IF NOT EXISTS covers_from date
  CHECK (covers_from IS NULL OR EXTRACT(DAY FROM covers_from) = 1);
