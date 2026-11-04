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

-- Only the payer or the receiver can record it, as themselves, while living in
-- the house. The other person must be in the house now, or have lived there
-- (so a debt with someone who moved out can still be paid back).
DROP POLICY IF EXISTS "payer or receiver can record settlement payments" ON settlement_payments;
CREATE POLICY "payer or receiver can record settlement payments" ON settlement_payments FOR INSERT
  WITH CHECK (
    house_id IN (SELECT public.get_my_house_ids())
    AND created_by = auth.uid()
    AND auth.uid() IN (from_user, to_user)
    AND (
      EXISTS (
        SELECT 1 FROM house_members m
        WHERE m.house_id = settlement_payments.house_id AND m.user_id = settlement_payments.from_user
      )
      OR EXISTS (
        SELECT 1 FROM former_members f
        WHERE f.house_id = settlement_payments.house_id AND f.user_id = settlement_payments.from_user
      )
    )
    AND (
      EXISTS (
        SELECT 1 FROM house_members m
        WHERE m.house_id = settlement_payments.house_id AND m.user_id = settlement_payments.to_user
      )
      OR EXISTS (
        SELECT 1 FROM former_members f
        WHERE f.house_id = settlement_payments.house_id AND f.user_id = settlement_payments.to_user
      )
    )
  );

-- Only the payer or the receiver can fix a recorded payment (amount, date,
-- note). Who paid whom and the house can't change — that's a new payment.
-- Every edit keeps the old values in the house's change history (below).
DROP POLICY IF EXISTS "payer or receiver can edit settlement payments" ON settlement_payments;
CREATE POLICY "payer or receiver can edit settlement payments" ON settlement_payments FOR UPDATE
  USING (
    house_id IN (SELECT public.get_my_house_ids())
    AND auth.uid() IN (from_user, to_user)
  )
  WITH CHECK (
    house_id IN (SELECT public.get_my_house_ids())
    AND auth.uid() IN (from_user, to_user)
  );

CREATE OR REPLACE FUNCTION fn_guard_settlement_payment_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.house_id   IS DISTINCT FROM OLD.house_id   OR
     NEW.from_user  IS DISTINCT FROM OLD.from_user  OR
     NEW.to_user    IS DISTINCT FROM OLD.to_user    OR
     NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only the amount, date and note of a payment can be changed.';
  END IF;
  NEW.updated_at := now();
  INSERT INTO audit_log(house_id, actor_id, table_name, record_id, old_data)
  VALUES (OLD.house_id, auth.uid(), 'settlement_payments_update', OLD.id, to_jsonb(OLD));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_settlement_payments_update ON settlement_payments;
CREATE TRIGGER guard_settlement_payments_update
  BEFORE UPDATE ON settlement_payments
  FOR EACH ROW EXECUTE FUNCTION fn_guard_settlement_payment_update();

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

-- ── Settle up to a date: one house at a time, never on stale numbers ────────
-- Two phones confirming at the same moment would otherwise record the same
-- month twice. This takes a per-house lock, checks the phone saw the latest
-- payments (count + newest change), and only then inserts — all or nothing.
-- SECURITY INVOKER: the insert still goes through the RLS policies above.
CREATE OR REPLACE FUNCTION public.record_settle_up_to(
  p_house_id    uuid,
  p_up_to       date,
  p_paid_on     date,
  p_seen_count  integer,
  p_seen_latest timestamptz,
  p_transfers   jsonb
) RETURNS SETOF settlement_payments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count  integer;
  v_latest timestamptz;
BEGIN
  IF p_house_id NOT IN (SELECT public.get_my_house_ids()) THEN
    RAISE EXCEPTION 'not a member of this house' USING ERRCODE = '42501';
  END IF;
  IF p_up_to > current_date + 1 OR p_paid_on > current_date + 1 THEN
    RAISE EXCEPTION 'date is in the future' USING ERRCODE = '22007';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('settle-up:' || p_house_id::text, 0));

  -- Newest change (a new payment or an edit) — so an edit counts as "changed" too.
  SELECT count(*), max(greatest(created_at, updated_at)) INTO v_count, v_latest
  FROM settlement_payments WHERE house_id = p_house_id;
  IF v_count <> p_seen_count OR v_latest IS DISTINCT FROM p_seen_latest THEN
    RAISE EXCEPTION 'stale_balances' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  INSERT INTO settlement_payments (house_id, from_user, to_user, amount, paid_on, covers_until)
  SELECT p_house_id, (t->>'from')::uuid, (t->>'to')::uuid, (t->>'amount')::numeric, p_paid_on, p_up_to
  FROM jsonb_array_elements(p_transfers) AS t
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.record_settle_up_to(uuid, date, date, integer, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_settle_up_to(uuid, date, date, integer, timestamptz, jsonb) TO authenticated;
