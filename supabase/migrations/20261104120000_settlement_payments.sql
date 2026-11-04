-- Money paid directly between two housemates to settle up ("Dana paid Maya ₪500").
--
-- Each row lowers what `from_user` owes `to_user` by exactly `amount`, so partial
-- payments add up correctly. Rows are never edited: a mistake is fixed by
-- deleting the row (copied to audit_log) and recording it again.
--
-- `covers_until` is set when the row came from "Settle up to a date" and is
-- only a label ("settled up to 31 Oct") — the maths never reads it.

CREATE TABLE IF NOT EXISTS settlement_payments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  from_user    uuid NOT NULL,
  to_user      uuid NOT NULL,
  amount       numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_on      date NOT NULL DEFAULT current_date,
  covers_until date,
  note         text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by   uuid NOT NULL DEFAULT auth.uid(),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CHECK (from_user <> to_user)
);

CREATE INDEX IF NOT EXISTS idx_settlement_payments_house_id ON settlement_payments(house_id);
CREATE INDEX IF NOT EXISTS idx_settlement_payments_from_user ON settlement_payments(from_user);
CREATE INDEX IF NOT EXISTS idx_settlement_payments_to_user ON settlement_payments(to_user);

ALTER TABLE settlement_payments ENABLE ROW LEVEL SECURITY;

-- Everyone in the house can see every payment (shared money, shared visibility).
DROP POLICY IF EXISTS "house members can read settlement payments" ON settlement_payments;
CREATE POLICY "house members can read settlement payments" ON settlement_payments FOR SELECT
  USING (house_id IN (SELECT public.get_my_house_ids()));

-- Only the payer or the receiver can record it, as themselves, and both people
-- must currently be members of the house.
DROP POLICY IF EXISTS "payer or receiver can record settlement payments" ON settlement_payments;
CREATE POLICY "payer or receiver can record settlement payments" ON settlement_payments FOR INSERT
  WITH CHECK (
    house_id IN (SELECT public.get_my_house_ids())
    AND created_by = auth.uid()
    AND auth.uid() IN (from_user, to_user)
    AND EXISTS (
      SELECT 1 FROM house_members m
      WHERE m.house_id = settlement_payments.house_id AND m.user_id = settlement_payments.from_user
    )
    AND EXISTS (
      SELECT 1 FROM house_members m
      WHERE m.house_id = settlement_payments.house_id AND m.user_id = settlement_payments.to_user
    )
  );

-- No UPDATE policy on purpose: recorded payments can't be quietly changed.

-- Only the payer or the receiver can delete (undo) it.
DROP POLICY IF EXISTS "payer or receiver can delete settlement payments" ON settlement_payments;
CREATE POLICY "payer or receiver can delete settlement payments" ON settlement_payments FOR DELETE
  USING (
    house_id IN (SELECT public.get_my_house_ids())
    AND auth.uid() IN (from_user, to_user)
  );

-- Deletes are kept in the house's change history, like bills and payments.
DROP TRIGGER IF EXISTS audit_settlement_payments_delete ON settlement_payments;
CREATE TRIGGER audit_settlement_payments_delete
  BEFORE DELETE ON settlement_payments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_delete();

-- Realtime so every phone's balance updates instantly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'settlement_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE settlement_payments;
  END IF;
END $$;
