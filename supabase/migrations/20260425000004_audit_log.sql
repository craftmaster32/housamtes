-- Audit log for destructive actions on financial and legal records.
-- Captures a snapshot of each deleted row so admins have a post-incident trail.
-- Only admins/owners can read; no client can insert, update, or delete entries.

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id    uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  actor_id    uuid,                      -- auth.uid() at delete time; null if service role
  table_name  text NOT NULL,
  record_id   uuid NOT NULL,
  old_data    jsonb NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_house_id   ON audit_log(house_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins/owners can read; nobody can write directly (only triggers can insert)
CREATE POLICY "admin or owner can read audit log" ON audit_log FOR SELECT
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Shared trigger function ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log(house_id, actor_id, table_name, record_id, old_data)
  VALUES (
    OLD.house_id,
    auth.uid(),        -- null when called via service role (edge functions)
    TG_TABLE_NAME,
    OLD.id,
    to_jsonb(OLD)
  );
  RETURN OLD;
END;
$$;

-- ── Triggers ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_bills_delete ON bills;
CREATE TRIGGER audit_bills_delete
  BEFORE DELETE ON bills
  FOR EACH ROW EXECUTE FUNCTION fn_audit_delete();

DROP TRIGGER IF EXISTS audit_household_payments_delete ON household_payments;
CREATE TRIGGER audit_household_payments_delete
  BEFORE DELETE ON household_payments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_delete();

DROP TRIGGER IF EXISTS audit_condition_entries_delete ON condition_entries;
CREATE TRIGGER audit_condition_entries_delete
  BEFORE DELETE ON condition_entries
  FOR EACH ROW EXECUTE FUNCTION fn_audit_delete();
