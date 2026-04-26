-- ============================================================
-- Replace all display-name actor columns with uuid FK refs.
-- Dev app: clears existing name-based rows (not UUID-compatible).
-- ============================================================

BEGIN;

-- ── bills ──────────────────────────────────────────────────
DELETE FROM bills;
ALTER TABLE bills
  DROP COLUMN paid_by,
  DROP COLUMN split_between,
  DROP COLUMN settled_by;
ALTER TABLE bills
  ADD COLUMN paid_by       uuid   NOT NULL REFERENCES auth.users(id),
  ADD COLUMN split_between uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN settled_by    uuid   REFERENCES auth.users(id);

-- ── chores ─────────────────────────────────────────────────
DELETE FROM chores;
ALTER TABLE chores DROP COLUMN assigned_to;
ALTER TABLE chores ADD COLUMN assigned_to uuid REFERENCES auth.users(id);

-- ── parking_sessions ───────────────────────────────────────
DELETE FROM parking_sessions;
ALTER TABLE parking_sessions DROP COLUMN occupant;
ALTER TABLE parking_sessions ADD COLUMN occupant uuid NOT NULL REFERENCES auth.users(id);

-- Prevent concurrent-claim race: only one active session per house
CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_sessions_one_active
  ON parking_sessions (house_id) WHERE is_active = true;

-- ── parking_reservations ───────────────────────────────────
DELETE FROM parking_reservations;
ALTER TABLE parking_reservations DROP COLUMN requested_by;
ALTER TABLE parking_reservations ADD COLUMN requested_by uuid NOT NULL REFERENCES auth.users(id);

-- ── grocery_items ──────────────────────────────────────────
DELETE FROM grocery_items;
ALTER TABLE grocery_items DROP COLUMN added_by;
ALTER TABLE grocery_items ADD COLUMN added_by uuid NOT NULL REFERENCES auth.users(id);

-- ── recurring_bills ────────────────────────────────────────
DELETE FROM recurring_bills;
ALTER TABLE recurring_bills DROP COLUMN assigned_to;
ALTER TABLE recurring_bills ADD COLUMN assigned_to uuid NOT NULL REFERENCES auth.users(id);

-- ── events ─────────────────────────────────────────────────
DELETE FROM events;
ALTER TABLE events DROP COLUMN created_by;
ALTER TABLE events ADD COLUMN created_by uuid NOT NULL REFERENCES auth.users(id);

-- ── announcements ──────────────────────────────────────────
DELETE FROM announcements;
ALTER TABLE announcements DROP COLUMN author;
ALTER TABLE announcements ADD COLUMN author uuid NOT NULL REFERENCES auth.users(id);

-- ── chat_messages ──────────────────────────────────────────
DELETE FROM chat_messages;
ALTER TABLE chat_messages DROP COLUMN sender;
ALTER TABLE chat_messages ADD COLUMN sender uuid NOT NULL REFERENCES auth.users(id);

-- ── maintenance_requests ───────────────────────────────────
DELETE FROM maintenance_requests;
ALTER TABLE maintenance_requests DROP COLUMN reported_by;
ALTER TABLE maintenance_requests ADD COLUMN reported_by uuid NOT NULL REFERENCES auth.users(id);

-- ── proposals ──────────────────────────────────────────────
DELETE FROM proposals;
ALTER TABLE proposals DROP COLUMN created_by;
ALTER TABLE proposals ADD COLUMN created_by uuid NOT NULL REFERENCES auth.users(id);

-- ── condition_entries ──────────────────────────────────────
DELETE FROM condition_entries;
ALTER TABLE condition_entries DROP COLUMN recorded_by;
ALTER TABLE condition_entries ADD COLUMN recorded_by uuid NOT NULL REFERENCES auth.users(id);

COMMIT;
