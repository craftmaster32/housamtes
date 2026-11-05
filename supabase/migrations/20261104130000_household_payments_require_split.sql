-- Every new recurring-bill payment must say who shares it.
--
-- A payment saved without names ("split with everyone") gets re-divided when
-- someone joins or leaves. The app now always saves the names; this makes the
-- database refuse any new payment (or edit) that leaves them out.
--
-- NOT VALID: existing rows are NOT checked or changed — older payments saved
-- without names stay exactly as they are (the app splits those between the
-- people who lived there on the day). Only inserts and updates are checked.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_payments_split_between_required'
      AND conrelid = 'public.household_payments'::regclass
  ) THEN
    ALTER TABLE household_payments
      ADD CONSTRAINT household_payments_split_between_required
      CHECK (coalesce(array_length(split_between, 1), 0) > 0) NOT VALID;
  END IF;
END $$;
