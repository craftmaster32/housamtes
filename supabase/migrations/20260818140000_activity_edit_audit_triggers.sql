-- Harden edit-audit columns so the database — not the client — stamps edited_by
-- and edited_at.  Without this a malicious client could forge any actor UUID or
-- clear attribution entirely.
--
-- Strategy: a BEFORE UPDATE trigger intercepts any write that tries to change
-- edited_by.  It overwrites the client-supplied value with auth.uid() and sets
-- edited_at to now().  Rows that are updated WITHOUT touching edited_by (e.g.
-- settling a bill, ticking off a grocery item) are not affected — the trigger
-- only fires when edited_by IS DISTINCT FROM its previous value, preserving the
-- separation from updated_at that the columns were introduced to maintain.

CREATE OR REPLACE FUNCTION enforce_edit_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.edited_by IS DISTINCT FROM OLD.edited_by AND NEW.edited_by IS NOT NULL THEN
    NEW.edited_by := auth.uid();
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- bills
CREATE OR REPLACE TRIGGER enforce_bills_edit_audit
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

-- recurring_bills
CREATE OR REPLACE TRIGGER enforce_recurring_bills_edit_audit
  BEFORE UPDATE ON recurring_bills
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

-- household_payments
CREATE OR REPLACE TRIGGER enforce_household_payments_edit_audit
  BEFORE UPDATE ON household_payments
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

-- grocery_items
CREATE OR REPLACE TRIGGER enforce_grocery_items_edit_audit
  BEFORE UPDATE ON grocery_items
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

-- announcements
CREATE OR REPLACE TRIGGER enforce_announcements_edit_audit
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();
