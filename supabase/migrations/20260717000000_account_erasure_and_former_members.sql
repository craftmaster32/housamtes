-- ============================================================
-- Account erasure (GDPR / App Store "delete my account") + former members.
--
-- Problem: the delete-account edge function calls auth.admin.deleteUser, but
-- the actor/author columns added in 20260424000000_user_id_columns.sql
-- reference auth.users(id) with NO on-delete action. Once a user has paid a
-- bill, sent a message, etc., deleting the auth user is blocked by a
-- foreign-key violation and the account can never be deleted.
--
-- Fix (Facebook / Slack model — erase the person, keep the shared record
-- anonymised so the household's history stays intact):
--   1. Make every shared actor column nullable and re-point its FK to
--      ON DELETE SET NULL. Deleting the user blanks the reference instead of
--      blocking. The bill / message / item survives with no owner; the app
--      shows "Former member".
--   2. Allow the settled-bill freeze trigger to blank (anonymise) the payer /
--      settler on erasure, while still blocking any reassignment to a
--      different person — tamper-evidence is preserved.
--   3. former_members: a lightweight record kept when someone LEAVES or is
--      REMOVED (their account still exists) so history can show
--      "Alex (left)" instead of a blank. Account deletion does NOT write
--      here — an erased user leaves no name behind.
-- ============================================================

BEGIN;

-- ── 1. Shared actor columns: nullable + ON DELETE SET NULL ──────────────────
-- Helper note: these constraints were auto-named {table}_{column}_fkey when the
-- columns were first added with `ADD COLUMN ... REFERENCES`. Drops are IF EXISTS
-- so this migration is safe to re-run.

ALTER TABLE bills ALTER COLUMN paid_by DROP NOT NULL;
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_paid_by_fkey;
ALTER TABLE bills
  ADD CONSTRAINT bills_paid_by_fkey
  FOREIGN KEY (paid_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_settled_by_fkey;
ALTER TABLE bills
  ADD CONSTRAINT bills_settled_by_fkey
  FOREIGN KEY (settled_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE chores DROP CONSTRAINT IF EXISTS chores_assigned_to_fkey;
ALTER TABLE chores
  ADD CONSTRAINT chores_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE parking_sessions ALTER COLUMN occupant DROP NOT NULL;
ALTER TABLE parking_sessions DROP CONSTRAINT IF EXISTS parking_sessions_occupant_fkey;
ALTER TABLE parking_sessions
  ADD CONSTRAINT parking_sessions_occupant_fkey
  FOREIGN KEY (occupant) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE parking_reservations ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE parking_reservations DROP CONSTRAINT IF EXISTS parking_reservations_requested_by_fkey;
ALTER TABLE parking_reservations
  ADD CONSTRAINT parking_reservations_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE grocery_items ALTER COLUMN added_by DROP NOT NULL;
ALTER TABLE grocery_items DROP CONSTRAINT IF EXISTS grocery_items_added_by_fkey;
ALTER TABLE grocery_items
  ADD CONSTRAINT grocery_items_added_by_fkey
  FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE recurring_bills ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE recurring_bills DROP CONSTRAINT IF EXISTS recurring_bills_assigned_to_fkey;
ALTER TABLE recurring_bills
  ADD CONSTRAINT recurring_bills_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE events ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE announcements ALTER COLUMN author DROP NOT NULL;
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_author_fkey;
ALTER TABLE announcements
  ADD CONSTRAINT announcements_author_fkey
  FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE chat_messages ALTER COLUMN sender DROP NOT NULL;
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_fkey;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_sender_fkey
  FOREIGN KEY (sender) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE maintenance_requests ALTER COLUMN reported_by DROP NOT NULL;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_reported_by_fkey;
ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE proposals ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_created_by_fkey;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE condition_entries ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE condition_entries DROP CONSTRAINT IF EXISTS condition_entries_recorded_by_fkey;
ALTER TABLE condition_entries
  ADD CONSTRAINT condition_entries_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Let erasure anonymise a settled bill's payer without unfreezing it ────
-- The freeze trigger blocks any change to a settled bill's payer/settler. That
-- also blocks the SET NULL from account erasure. Allow the payer/settler to be
-- blanked to NULL (anonymisation) but still reject reassignment to another
-- person or any change to the money fields.
CREATE OR REPLACE FUNCTION fn_block_settled_bill_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.settled = true THEN
    IF (NEW.amount        IS DISTINCT FROM OLD.amount)        OR
       (NEW.split_between IS DISTINCT FROM OLD.split_between) OR
       (NEW.split_amounts IS DISTINCT FROM OLD.split_amounts) OR
       (NEW.date          IS DISTINCT FROM OLD.date)          OR
       (NEW.settled       IS DISTINCT FROM OLD.settled)       OR
       -- payer / settler may be anonymised to NULL on account erasure, but
       -- never reassigned to a different person.
       (NEW.paid_by    IS DISTINCT FROM OLD.paid_by    AND NEW.paid_by    IS NOT NULL) OR
       (NEW.settled_by IS DISTINCT FROM OLD.settled_by AND NEW.settled_by IS NOT NULL)
    THEN
      RAISE EXCEPTION
        'Settled bills are locked — amounts, splits and settlement status '
        'cannot be changed after settling.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. former_members: keep a name for people who leave or are removed ───────
CREATE TABLE IF NOT EXISTS former_members (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id      uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  -- Cascade on erasure: if a person who left later deletes their account, this
  -- snapshot (which holds their name) must disappear too, so "delete my
  -- account" stays a full erasure.
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  avatar_color  text,
  left_reason   text NOT NULL DEFAULT 'left',  -- 'left' | 'removed'
  left_at       timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (house_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_former_members_house_id ON former_members(house_id);
CREATE INDEX IF NOT EXISTS idx_former_members_user_id ON former_members(user_id);

ALTER TABLE former_members ENABLE ROW LEVEL SECURITY;

-- Current house members can read who used to be in their house (for name display)
DROP POLICY IF EXISTS "house members can read former members" ON former_members;
CREATE POLICY "house members can read former members"
  ON former_members FOR SELECT
  USING (house_id IN (SELECT public.get_my_house_ids()));

-- A member may record their own departure from a house they currently belong to
-- (leaving); the house owner may record anyone's departure (removing a member).
DROP POLICY IF EXISTS "record own or owned-house departure" ON former_members;
CREATE POLICY "record own or owned-house departure"
  ON former_members FOR INSERT
  WITH CHECK (
    (user_id = auth.uid() AND house_id IN (SELECT public.get_my_house_ids()))
    OR house_id IN (SELECT id FROM houses WHERE created_by = auth.uid())
  );

-- Refresh an existing row when someone re-joins then leaves again — either the
-- person themselves (while a current member) or the house owner.
DROP POLICY IF EXISTS "owner can update former members" ON former_members;
CREATE POLICY "owner can update former members"
  ON former_members FOR UPDATE
  USING (
    (user_id = auth.uid() AND house_id IN (SELECT public.get_my_house_ids()))
    OR house_id IN (SELECT id FROM houses WHERE created_by = auth.uid())
  );

-- Removing the stale row when someone re-joins (own row or owner-managed).
DROP POLICY IF EXISTS "clear own or owned-house former row" ON former_members;
CREATE POLICY "clear own or owned-house former row"
  ON former_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR house_id IN (SELECT id FROM houses WHERE created_by = auth.uid())
  );

COMMIT;
