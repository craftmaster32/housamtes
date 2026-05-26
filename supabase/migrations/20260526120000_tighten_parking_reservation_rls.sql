-- Tighten parking_reservations INSERT policy to ensure a member can only
-- create a reservation on their own behalf, and make requested_by immutable
-- after creation via a trigger (WITH CHECK alone would break vote updates).

-- ── INSERT: require requested_by = auth.uid() ─────────────────────────────────
DROP POLICY IF EXISTS "house members can insert parking reservations" ON parking_reservations;
CREATE POLICY "house members can insert parking reservations"
  ON parking_reservations FOR INSERT
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND requested_by = auth.uid()
  );

-- ── UPDATE: prevent requested_by from being changed after creation ────────────
CREATE OR REPLACE FUNCTION prevent_parking_requested_by_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.requested_by IS DISTINCT FROM NEW.requested_by THEN
    RAISE EXCEPTION 'requested_by cannot be modified after creation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parking_reservations_immutable_requested_by ON parking_reservations;
CREATE TRIGGER trg_parking_reservations_immutable_requested_by
  BEFORE UPDATE ON parking_reservations
  FOR EACH ROW EXECUTE FUNCTION prevent_parking_requested_by_change();
