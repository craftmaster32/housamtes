-- Add start_time / end_time to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS end_time   text;

-- Add start_time / end_time to parking_reservations
ALTER TABLE parking_reservations
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS end_time   text;
