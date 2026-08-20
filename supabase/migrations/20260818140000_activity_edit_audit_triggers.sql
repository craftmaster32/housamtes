-- Harden edit-audit columns so the DATABASE — not the client — decides who
-- edited a shared record and when. Without this a housemate could craft a raw
-- API call to forge any actor UUID, clear an existing attribution, or make a
-- "stealth" edit (change a field without stamping the audit columns) that never
-- shows in the activity bell.
--
-- The columns (edited_at, edited_by, logged_by) were added in
-- 20260818130000_activity_edit_tracking.sql; this migration is the enforcement.
--
-- Design:
--   * On UPDATE, the trigger looks at whether the row's *content* actually
--     changed — the same fields the app's edit actions touch — and, if so,
--     stamps edited_by = auth.uid() and edited_at = now(). This is what makes a
--     stealth edit impossible: the stamp is driven by the data change itself,
--     not by whatever the client put in the audit columns.
--   * Settling a bill, ticking a grocery item, completing a task or archiving a
--     note change only operational fields (settled_*, is_checked, is_pinned, …),
--     which are deliberately NOT in the content lists — so those updates never
--     look like an edit, preserving the separation from `updated_at`.
--   * If an update touches the audit columns WITHOUT a real content change (a
--     pure forge/clear attempt), the trigger reverts them to their old values.
--   * SECURITY INVOKER + a pinned search_path: the function only rewrites the
--     NEW row and reads auth.uid()/now(), so it needs no elevated privilege, and
--     pinning search_path avoids the mutable-search_path lint the codebase
--     already hardened its other trigger functions against.
--
-- Scope note: pre-existing client-set actor columns (bills.paid_by,
-- bills.settled_by, announcements.author, house_tasks.created_by,
-- grocery_items.added_by) are intentionally left as-is here — tightening those
-- is a separate, schema-wide change, not part of this feature.

CREATE OR REPLACE FUNCTION enforce_edit_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  content_changed boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'bills' THEN
    content_changed := (NEW.title    IS DISTINCT FROM OLD.title)
                    OR (NEW.amount   IS DISTINCT FROM OLD.amount)
                    OR (NEW.date     IS DISTINCT FROM OLD.date)
                    OR (NEW.notes    IS DISTINCT FROM OLD.notes)
                    OR (NEW.category IS DISTINCT FROM OLD.category);
  ELSIF TG_TABLE_NAME = 'recurring_bills' THEN
    content_changed := (NEW.name           IS DISTINCT FROM OLD.name)
                    OR (NEW.assigned_to    IS DISTINCT FROM OLD.assigned_to)
                    OR (NEW.frequency      IS DISTINCT FROM OLD.frequency)
                    OR (NEW.typical_amount IS DISTINCT FROM OLD.typical_amount)
                    OR (NEW.icon           IS DISTINCT FROM OLD.icon);
  ELSIF TG_TABLE_NAME = 'household_payments' THEN
    NEW.logged_by := OLD.logged_by;
    content_changed := (NEW.amount        IS DISTINCT FROM OLD.amount)
                    OR (NEW.paid_at       IS DISTINCT FROM OLD.paid_at)
                    OR (NEW.note          IS DISTINCT FROM OLD.note)
                    OR (NEW.split_between IS DISTINCT FROM OLD.split_between);
  ELSIF TG_TABLE_NAME = 'grocery_items' THEN
    content_changed := (NEW.name     IS DISTINCT FROM OLD.name)
                    OR (NEW.quantity IS DISTINCT FROM OLD.quantity);
  ELSIF TG_TABLE_NAME = 'announcements' THEN
    content_changed := (NEW.text IS DISTINCT FROM OLD.text);
  END IF;

  IF content_changed THEN
    -- A genuine edit: the database decides who and when, ignoring client input.
    NEW.edited_by := auth.uid();
    NEW.edited_at := now();
  ELSE
    -- No real edit — never let a non-edit forge or clear the attribution.
    NEW.edited_by := OLD.edited_by;
    NEW.edited_at := OLD.edited_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bills_edit_audit ON bills;
CREATE TRIGGER enforce_bills_edit_audit
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

DROP TRIGGER IF EXISTS enforce_recurring_bills_edit_audit ON recurring_bills;
CREATE TRIGGER enforce_recurring_bills_edit_audit
  BEFORE UPDATE ON recurring_bills
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

DROP TRIGGER IF EXISTS enforce_household_payments_edit_audit ON household_payments;
CREATE TRIGGER enforce_household_payments_edit_audit
  BEFORE UPDATE ON household_payments
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

DROP TRIGGER IF EXISTS enforce_grocery_items_edit_audit ON grocery_items;
CREATE TRIGGER enforce_grocery_items_edit_audit
  BEFORE UPDATE ON grocery_items
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

DROP TRIGGER IF EXISTS enforce_announcements_edit_audit ON announcements;
CREATE TRIGGER enforce_announcements_edit_audit
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_audit();

-- ── Payment logger provenance (INSERT) ──────────────────────────────────────
-- Whoever inserts a household payment is its logger. Force logged_by from
-- auth.uid() so it cannot be forged; fall back to the supplied value only when
-- there is no authenticated user (e.g. a service-role edge function).
CREATE OR REPLACE FUNCTION enforce_payment_logger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.logged_by := COALESCE(auth.uid(), NEW.logged_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_household_payments_logger ON household_payments;
CREATE TRIGGER enforce_household_payments_logger
  BEFORE INSERT ON household_payments
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_logger();
