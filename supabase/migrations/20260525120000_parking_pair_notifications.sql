-- Pair-level back-to-back notification tracking.
-- Replaces the per-reservation back_to_back_notified boolean with a record per
-- adjacent-reservation pair so chains like A→B→C correctly notify B about C.
CREATE TABLE IF NOT EXISTS parking_pair_notifications (
  a_id       uuid NOT NULL REFERENCES parking_reservations(id) ON DELETE CASCADE,
  b_id       uuid NOT NULL REFERENCES parking_reservations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (a_id, b_id)
);

CREATE INDEX IF NOT EXISTS idx_ppn_a_id ON parking_pair_notifications(a_id);

ALTER TABLE parking_pair_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house members can read parking pair notifications"
  ON parking_pair_notifications FOR SELECT
  USING (
    a_id IN (
      SELECT id FROM parking_reservations
      WHERE house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    )
  );
