-- Harden client-set actor columns so the DATABASE — not the client — decides
-- who created/settled/completed/added a record. Without this, a housemate could
-- craft a raw API call to:
--   * attribute an action to another housemate (forge actor UUID)
--   * clear an existing attribution (set to NULL)
--   * bypass attribution entirely (stealth action)
--
-- Pattern mirrors enforce_edit_audit() from PR #206: SECURITY INVOKER,
-- pinned search_path, COALESCE(auth.uid(), NEW.col) so service-role edge
-- functions (where auth.uid() is NULL) still work.
--
-- Design choices per column:
--   * INSERT-only creator columns (paid_by, added_by, author, created_by):
--     BEFORE INSERT trigger forces from auth.uid(). The app already passes
--     the correct value, but the trigger is the source of truth.
--   * State-transition columns (settled_by, completed_by): BEFORE UPDATE
--     trigger stamps auth.uid() only when the relevant state changes
--     (settled→true / is_done→true). Reverts if the transition is reversed
--     or if no transition occurs.
--   * No changes to already-hardened columns (edited_by, edited_by,
--     logged_by) — those are covered by enforce_edit_audit().

-- ── bills.paid_by ──────────────────────────────────────────────────────────
-- Force from auth.uid() on INSERT. On UPDATE, the block_settled_bill_edit
-- trigger already freezes paid_by on settled bills; for unsettled bills the
-- app may legitimately reassign the payer, so no UPDATE trigger here.
CREATE OR REPLACE FUNCTION enforce_bills_paid_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.paid_by := COALESCE(auth.uid(), NEW.paid_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bills_paid_by ON bills;
CREATE TRIGGER enforce_bills_paid_by
  BEFORE INSERT ON bills
  FOR EACH ROW EXECUTE FUNCTION enforce_bills_paid_by();

-- ── bills.settled_by ───────────────────────────────────────────────────────
-- Stamp auth.uid() when a bill transitions to settled. When settled is
-- set back to false (un-settle — currently blocked by the tamper trigger
-- but defense-in-depth), clear the attribution.
CREATE OR REPLACE FUNCTION enforce_bills_settled_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.settled = true AND (OLD.settled IS DISTINCT FROM true) THEN
    NEW.settled_by := COALESCE(auth.uid(), NEW.settled_by);
    NEW.settled_at := COALESCE(NEW.settled_at, now());
  ELSIF NEW.settled = false AND OLD.settled = true THEN
    NEW.settled_by := NULL;
    NEW.settled_at := NULL;
  ELSE
    -- No settlement transition — freeze the attribution.
    NEW.settled_by := OLD.settled_by;
    NEW.settled_at := OLD.settled_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bills_settled_by ON bills;
CREATE TRIGGER enforce_bills_settled_by
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION enforce_bills_settled_by();

-- ── grocery_items.added_by ──────────────────────────────────────────────────
-- Force from auth.uid() on INSERT. The app already passes the correct
-- value, but this is the DB-level guarantee.
CREATE OR REPLACE FUNCTION enforce_grocery_added_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.added_by := COALESCE(auth.uid(), NEW.added_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_grocery_added_by ON grocery_items;
CREATE TRIGGER enforce_grocery_added_by
  BEFORE INSERT ON grocery_items
  FOR EACH ROW EXECUTE FUNCTION enforce_grocery_added_by();

-- ── house_tasks.created_by ──────────────────────────────────────────────────
-- Defense-in-depth alongside the RLS WITH CHECK constraint. Even if RLS
-- is bypassed (e.g. a future service-role path forgets BYPASSRLS), the
-- trigger pins the creator.
CREATE OR REPLACE FUNCTION enforce_tasks_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tasks_created_by ON house_tasks;
CREATE TRIGGER enforce_tasks_created_by
  BEFORE INSERT ON house_tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_tasks_created_by();

-- ── house_tasks.completed_by ────────────────────────────────────────────────
-- Stamp auth.uid() when is_done flips to true; clear when unchecked.
CREATE OR REPLACE FUNCTION enforce_tasks_completed_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_done = true AND (OLD.is_done IS DISTINCT FROM true) THEN
    NEW.completed_by := COALESCE(auth.uid(), NEW.completed_by);
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.is_done = false AND OLD.is_done = true THEN
    NEW.completed_by := NULL;
    NEW.completed_at := NULL;
  ELSE
    -- No transition — freeze the attribution.
    NEW.completed_by := OLD.completed_by;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tasks_completed_by ON house_tasks;
CREATE TRIGGER enforce_tasks_completed_by
  BEFORE UPDATE ON house_tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_tasks_completed_by();

-- ── announcements.author ────────────────────────────────────────────────────
-- Force from auth.uid() on INSERT. The app already passes the correct
-- value, but this is the DB-level guarantee.
CREATE OR REPLACE FUNCTION enforce_announcements_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.author := COALESCE(auth.uid(), NEW.author);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_announcements_author ON announcements;
CREATE TRIGGER enforce_announcements_author
  BEFORE INSERT ON announcements
  FOR EACH ROW EXECUTE FUNCTION enforce_announcements_author();

-- ── houses.created_by ───────────────────────────────────────────────────────
-- Defense-in-depth alongside the RLS USING constraint. Even if RLS is
-- bypassed, the trigger pins the creator.
CREATE OR REPLACE FUNCTION enforce_houses_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_houses_created_by ON houses;
CREATE TRIGGER enforce_houses_created_by
  BEFORE INSERT ON houses
  FOR EACH ROW EXECUTE FUNCTION enforce_houses_created_by();
