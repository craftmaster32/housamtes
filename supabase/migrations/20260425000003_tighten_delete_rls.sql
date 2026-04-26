-- Tighten DELETE policies on shared tables.
-- Previously any house member could delete chores, events, announcements,
-- maintenance requests, parking sessions, reservations, and recurring bills.
-- Now restricted to the record's creator OR an admin/owner.
-- Tables that have no creator column (chores, recurring_bills, household_payments)
-- are restricted to admin/owner only.
-- Note: creator columns were converted to uuid by 20260424000000_user_id_columns.sql
-- so we compare directly with auth.uid() — no ::text cast needed.

-- ── CHORES (no creator column → admin/owner only) ────────────────────────────
DROP POLICY IF EXISTS "house members can delete chores" ON chores;
CREATE POLICY "admin or owner can delete chores" ON chores FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── EVENTS (created_by uuid) ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "house members can delete events" ON events;
CREATE POLICY "creator or admin can delete events" ON events FOR DELETE
  USING (
    created_by = auth.uid() OR
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── ANNOUNCEMENTS (author uuid) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "house members can delete announcements" ON announcements;
CREATE POLICY "author or admin can delete announcements" ON announcements FOR DELETE
  USING (
    author = auth.uid() OR
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── MAINTENANCE REQUESTS (reported_by uuid) ───────────────────────────────────
DROP POLICY IF EXISTS "house members can delete maintenance" ON maintenance_requests;
CREATE POLICY "reporter or admin can delete maintenance" ON maintenance_requests FOR DELETE
  USING (
    reported_by = auth.uid() OR
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── PARKING SESSIONS (occupant uuid) ─────────────────────────────────────────
DROP POLICY IF EXISTS "house members can delete parking sessions" ON parking_sessions;
CREATE POLICY "occupant or admin can delete parking sessions" ON parking_sessions FOR DELETE
  USING (
    occupant = auth.uid() OR
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── PARKING RESERVATIONS (requested_by uuid) ──────────────────────────────────
DROP POLICY IF EXISTS "house members can delete parking reservations" ON parking_reservations;
CREATE POLICY "requester or admin can delete parking reservations" ON parking_reservations FOR DELETE
  USING (
    requested_by = auth.uid() OR
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── RECURRING BILLS (no creator column → admin/owner only) ───────────────────
DROP POLICY IF EXISTS "house members can delete recurring bills" ON recurring_bills;
CREATE POLICY "admin or owner can delete recurring bills" ON recurring_bills FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── HOUSEHOLD PAYMENTS (no creator column → admin/owner only) ────────────────
DROP POLICY IF EXISTS "house members can delete household payments" ON household_payments;
CREATE POLICY "admin or owner can delete household payments" ON household_payments FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
