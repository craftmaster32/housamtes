-- ============================================================
-- Bill tamper-evidence hardening
-- ============================================================
-- Goal: nobody can quietly rewrite the house's money records.
--
--   1. Settled bills become immutable: once settled, the financial fields
--      (amount, payer, split, date) are frozen and the bill cannot be
--      un-settled. Enforced in the database, so no client can bypass it.
--   2. Recurring-bill changes (amount, assignee, frequency, name) and
--      deletes are captured in the audit log, like one-off bills already are.
--   3. Every house member can read the audit log for their house — not just
--      owners/admins. Shared money means shared visibility; transparency to
--      the whole house is what makes silent edits impossible.
--   4. Pin search_path on the remaining SECURITY DEFINER functions
--      (Supabase linter: function_search_path_mutable). Prevents a
--      search-path hijack from redirecting privileged writes.

-- ── 1. Freeze settled bills ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_block_settled_bill_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.settled = true THEN
    IF (NEW.amount        IS DISTINCT FROM OLD.amount)        OR
       (NEW.paid_by       IS DISTINCT FROM OLD.paid_by)       OR
       (NEW.split_between IS DISTINCT FROM OLD.split_between) OR
       (NEW.split_amounts IS DISTINCT FROM OLD.split_amounts) OR
       (NEW.date          IS DISTINCT FROM OLD.date)          OR
       (NEW.settled       IS DISTINCT FROM OLD.settled)
    THEN
      RAISE EXCEPTION
        'Settled bills are locked — amounts, splits and settlement status '
        'cannot be changed after settling.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_settled_bill_edit ON bills;
CREATE TRIGGER block_settled_bill_edit
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION fn_block_settled_bill_edit();

-- ── 2. Audit recurring-bill changes ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_recurring_bill_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.typical_amount IS DISTINCT FROM NEW.typical_amount) OR
     (OLD.assigned_to    IS DISTINCT FROM NEW.assigned_to)    OR
     (OLD.frequency      IS DISTINCT FROM NEW.frequency)      OR
     (OLD.name           IS DISTINCT FROM NEW.name)
  THEN
    INSERT INTO audit_log(house_id, actor_id, table_name, record_id, old_data)
    VALUES (OLD.house_id, auth.uid(), 'recurring_bills_update', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_recurring_bills_update ON recurring_bills;
CREATE TRIGGER audit_recurring_bills_update
  AFTER UPDATE ON recurring_bills
  FOR EACH ROW EXECUTE FUNCTION fn_audit_recurring_bill_update();

DROP TRIGGER IF EXISTS audit_recurring_bills_delete ON recurring_bills;
CREATE TRIGGER audit_recurring_bills_delete
  BEFORE DELETE ON recurring_bills
  FOR EACH ROW EXECUTE FUNCTION fn_audit_delete();

-- ── 3. Audit log readable by every house member ─────────────────────────────
DROP POLICY IF EXISTS "admin or owner can read audit log" ON audit_log;
DROP POLICY IF EXISTS "house members can read audit log" ON audit_log;
CREATE POLICY "house members can read audit log"
  ON audit_log FOR SELECT
  USING (house_id IN (SELECT public.get_my_house_ids()));

-- ── 4. Pin search_path on remaining SECURITY DEFINER functions ──────────────
CREATE OR REPLACE FUNCTION fn_audit_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log(house_id, actor_id, table_name, record_id, old_data)
  VALUES (OLD.house_id, auth.uid(), TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION fn_audit_bill_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.amount        IS DISTINCT FROM NEW.amount)        OR
     (OLD.paid_by       IS DISTINCT FROM NEW.paid_by)       OR
     (OLD.split_between IS DISTINCT FROM NEW.split_between) OR
     (OLD.split_amounts IS DISTINCT FROM NEW.split_amounts) OR
     (OLD.settled       IS DISTINCT FROM NEW.settled)
  THEN
    INSERT INTO audit_log(house_id, actor_id, table_name, record_id, old_data)
    VALUES (OLD.house_id, auth.uid(), 'bills_update', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION reset_nfc_parking_token(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token uuid;
  v_rows_updated integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_new_token := gen_random_uuid();

  UPDATE profiles
    SET nfc_parking_token = v_new_token,
        updated_at = NOW()
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;

  RETURN v_new_token;
END;
$$;
