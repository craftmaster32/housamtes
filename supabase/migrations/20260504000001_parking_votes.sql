-- Allow 'rejected' as a valid reservation status
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'parking_reservations'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE parking_reservations DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE parking_reservations
  ADD CONSTRAINT parking_reservations_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Per-member votes on parking requests
CREATE TABLE IF NOT EXISTS parking_reservation_votes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id  uuid NOT NULL REFERENCES parking_reservations(id) ON DELETE CASCADE,
  house_id        uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  user_id         text NOT NULL,
  vote            text NOT NULL CHECK (vote IN ('approve', 'reject')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(reservation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_parking_votes_reservation_id ON parking_reservation_votes(reservation_id);
CREATE INDEX IF NOT EXISTS idx_parking_votes_house_id       ON parking_reservation_votes(house_id);
CREATE INDEX IF NOT EXISTS idx_parking_votes_user_id        ON parking_reservation_votes(user_id);

ALTER TABLE parking_reservation_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house members can read parking votes"
  ON parking_reservation_votes FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can insert parking votes"
  ON parking_reservation_votes FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can update own parking votes"
  ON parking_reservation_votes FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can delete own parking votes"
  ON parking_reservation_votes FOR DELETE
  USING (user_id = auth.uid()::text);

ALTER PUBLICATION supabase_realtime ADD TABLE parking_reservation_votes;