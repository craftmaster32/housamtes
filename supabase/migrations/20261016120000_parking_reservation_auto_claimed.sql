-- Marks a reservation once the spot has been handed to its holder during the
-- slot (by the app or the parking-check cron). The spot is only auto-claimed
-- for the holder once per reservation, so if they leave early and free the
-- spot it is not grabbed back for them on the next check.
-- Existing UPDATE policy ("house members can update parking reservations")
-- already covers this column; no new RLS needed.
ALTER TABLE parking_reservations
  ADD COLUMN IF NOT EXISTS auto_claimed boolean DEFAULT false NOT NULL;
