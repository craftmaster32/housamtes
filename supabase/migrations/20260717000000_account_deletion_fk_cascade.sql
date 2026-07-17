-- ============================================================
-- Fix: account deletion blocked by foreign-key violations.
--
-- The delete-account edge function calls auth.admin.deleteUser and
-- relies on FK cascades to remove the user's data. But the actor/author
-- columns added in 20260424000000_user_id_columns.sql reference
-- auth.users(id) with NO on-delete action (defaults to NO ACTION /
-- RESTRICT). Once a user has paid a bill, sent a chat message, added a
-- grocery item, etc., deleting the auth user is blocked and the function
-- returns "Could not delete account".
--
-- This migration re-points every one of those constraints:
--   NOT NULL author/creator columns -> ON DELETE CASCADE  (remove content)
--   nullable actor columns          -> ON DELETE SET NULL (keep row, clear actor)
--
-- Constraint names follow Postgres' default {table}_{column}_fkey, which
-- is what ADD COLUMN ... REFERENCES generated. Drops are IF EXISTS so the
-- migration is safe to re-run.
-- ============================================================

BEGIN;

-- ── bills ──────────────────────────────────────────────────
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_paid_by_fkey;
ALTER TABLE bills
  ADD CONSTRAINT bills_paid_by_fkey
  FOREIGN KEY (paid_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_settled_by_fkey;
ALTER TABLE bills
  ADD CONSTRAINT bills_settled_by_fkey
  FOREIGN KEY (settled_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── chores ─────────────────────────────────────────────────
ALTER TABLE chores DROP CONSTRAINT IF EXISTS chores_assigned_to_fkey;
ALTER TABLE chores
  ADD CONSTRAINT chores_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── parking_sessions ───────────────────────────────────────
ALTER TABLE parking_sessions DROP CONSTRAINT IF EXISTS parking_sessions_occupant_fkey;
ALTER TABLE parking_sessions
  ADD CONSTRAINT parking_sessions_occupant_fkey
  FOREIGN KEY (occupant) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── parking_reservations ───────────────────────────────────
ALTER TABLE parking_reservations DROP CONSTRAINT IF EXISTS parking_reservations_requested_by_fkey;
ALTER TABLE parking_reservations
  ADD CONSTRAINT parking_reservations_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── grocery_items ──────────────────────────────────────────
ALTER TABLE grocery_items DROP CONSTRAINT IF EXISTS grocery_items_added_by_fkey;
ALTER TABLE grocery_items
  ADD CONSTRAINT grocery_items_added_by_fkey
  FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── recurring_bills ────────────────────────────────────────
ALTER TABLE recurring_bills DROP CONSTRAINT IF EXISTS recurring_bills_assigned_to_fkey;
ALTER TABLE recurring_bills
  ADD CONSTRAINT recurring_bills_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── events ─────────────────────────────────────────────────
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── announcements ──────────────────────────────────────────
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_author_fkey;
ALTER TABLE announcements
  ADD CONSTRAINT announcements_author_fkey
  FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── chat_messages ──────────────────────────────────────────
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_fkey;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_sender_fkey
  FOREIGN KEY (sender) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── maintenance_requests ───────────────────────────────────
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_reported_by_fkey;
ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── proposals ──────────────────────────────────────────────
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_created_by_fkey;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── condition_entries ──────────────────────────────────────
ALTER TABLE condition_entries DROP CONSTRAINT IF EXISTS condition_entries_recorded_by_fkey;
ALTER TABLE condition_entries
  ADD CONSTRAINT condition_entries_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
