-- Let every house member delete recurring bills and their payments, and make
-- every change visible instead: deletes were already copied to audit_log (and
-- recurring-bill edits too), and this adds the same for payment edits, so the
-- app can show a full change history to the whole house.

-- ── 1. Any house member can delete recurring bills and payments ─────────────
DROP POLICY IF EXISTS "admin or owner can delete recurring bills" ON recurring_bills;
DROP POLICY IF EXISTS "house members can delete recurring bills" ON recurring_bills;
CREATE POLICY "house members can delete recurring bills" ON recurring_bills FOR DELETE
  USING (house_id IN (SELECT public.get_my_house_ids()));

DROP POLICY IF EXISTS "admin or owner can delete household payments" ON household_payments;
DROP POLICY IF EXISTS "house members can delete household payments" ON household_payments;
CREATE POLICY "house members can delete household payments" ON household_payments FOR DELETE
  USING (house_id IN (SELECT public.get_my_house_ids()));

-- ── 2. Audit payment edits (old values, like recurring-bill edits) ──────────
CREATE OR REPLACE FUNCTION fn_audit_household_payment_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.amount        IS DISTINCT FROM NEW.amount)        OR
     (OLD.paid_at       IS DISTINCT FROM NEW.paid_at)       OR
     (OLD.note          IS DISTINCT FROM NEW.note)          OR
     (OLD.split_between IS DISTINCT FROM NEW.split_between) OR
     (OLD.covers_from   IS DISTINCT FROM NEW.covers_from)
  THEN
    INSERT INTO audit_log(house_id, actor_id, table_name, record_id, old_data)
    VALUES (OLD.house_id, auth.uid(), 'household_payments_update', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_household_payments_update ON household_payments;
CREATE TRIGGER audit_household_payments_update
  AFTER UPDATE ON household_payments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_household_payment_update();

-- The app reads a house's recurring-bill history by table name.
CREATE INDEX IF NOT EXISTS idx_audit_log_house_table ON audit_log(house_id, table_name);
