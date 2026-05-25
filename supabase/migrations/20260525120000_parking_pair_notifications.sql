-- Pair-level back-to-back notification tracking.
-- Replaces the per-reservation back_to_back_notified boolean with a record per
-- adjacent-reservation pair so chains like A→B→C correctly notify B about C.
CREATE TABLE IF NOT EXISTS parking_pair_notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id   uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  a_id       uuid NOT NULL REFERENCES parking_reservations(id) ON DELETE CASCADE,
  b_id       uuid NOT NULL REFERENCES parking_reservations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (a_id, b_id)
);

CREATE INDEX IF NOT EXISTS idx_ppn_house_id ON parking_pair_notifications(house_id);

ALTER TABLE parking_pair_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house members can read parking pair notifications"
  ON parking_pair_notifications FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert parking pair notifications"
  ON parking_pair_notifications FOR INSERT
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND a_id IN (SELECT id FROM parking_reservations WHERE house_id = parking_pair_notifications.house_id)
    AND b_id IN (SELECT id FROM parking_reservations WHERE house_id = parking_pair_notifications.house_id)
  );

CREATE POLICY "house members can update parking pair notifications"
  ON parking_pair_notifications FOR UPDATE
  USING  (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()))
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND a_id IN (SELECT id FROM parking_reservations WHERE house_id = parking_pair_notifications.house_id)
    AND b_id IN (SELECT id FROM parking_reservations WHERE house_id = parking_pair_notifications.house_id)
  );

CREATE POLICY "house members can delete parking pair notifications"
  ON parking_pair_notifications FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));
