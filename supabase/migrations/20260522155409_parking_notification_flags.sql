-- Parking notification tracking flags
-- Prevents duplicate pushes from the parking-check cron function.
ALTER TABLE parking_reservations
  ADD COLUMN IF NOT EXISTS pending_notice_sent   boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS advance_warning_sent  boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS spot_taken_notified   boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS back_to_back_notified boolean DEFAULT false NOT NULL;
