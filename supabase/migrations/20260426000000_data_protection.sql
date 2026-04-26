-- Data protection: two layers of safety for financial records.
--
-- 1. Block deleting settled bills at the database level.
--    No client — not even admin — can erase a bill that has been settled.
--    Settlement history is permanent. The only way to remove it would be
--    direct service-role access (i.e., Anthropic-level infra access, never the app).
--
-- 2. Audit significant bill edits.
--    Whenever amount, split, or settled status changes on a bill, the old
--    values are saved to audit_log before the update is applied.
--    Owners/admins can recover original figures if numbers were changed by mistake.

-- ── 1. Block deleting settled bills ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_block_settled_bill_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.settled = true THEN
    RAISE EXCEPTION
      'Settled bills cannot be deleted — settlement history is permanent. '
      'Contact Nestiq support if you believe this record is in error.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS block_settled_bill_delete ON bills;
CREATE TRIGGER block_settled_bill_delete
  BEFORE DELETE ON bills
  FOR EACH ROW EXECUTE FUNCTION fn_block_settled_bill_delete();

-- ── 2. Audit significant bill updates ───────────────────────────────────────
-- Fires AFTER the update succeeds (no point logging a rolled-back change).
-- Only triggers when financial or split fields actually change.

CREATE OR REPLACE FUNCTION fn_audit_bill_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DROP TRIGGER IF EXISTS audit_bills_update ON bills;
CREATE TRIGGER audit_bills_update
  AFTER UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION fn_audit_bill_update();
