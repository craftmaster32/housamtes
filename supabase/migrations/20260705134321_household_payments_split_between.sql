-- Let a logged recurring-bill payment record which housemates share its cost.
-- NULL / empty means "split among all current housemates" (the default), so
-- existing rows keep working and are now counted in Settle Up.
ALTER TABLE household_payments
  ADD COLUMN IF NOT EXISTS split_between text[] NOT NULL DEFAULT '{}';
