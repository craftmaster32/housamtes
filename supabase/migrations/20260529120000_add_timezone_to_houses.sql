-- Add timezone to houses so the parking-check edge function can compare
-- reservation times in the correct local timezone per house.
ALTER TABLE houses ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';
