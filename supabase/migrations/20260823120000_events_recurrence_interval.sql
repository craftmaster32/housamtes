-- Custom repeat cadence for calendar events.
-- Adds an interval so a recurrence can be "every N units" (e.g. weekly with
-- interval 2 = every 2 weeks / biweekly), and widens the unit set to include
-- 'daily'. Existing rows keep their unit and default to an interval of 1.

ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1;

-- Interval must be a positive whole number.
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_recurrence_interval;
ALTER TABLE events ADD CONSTRAINT chk_events_recurrence_interval
  CHECK (recurrence_interval >= 1);

-- Widen the allowed recurrence units to include 'daily'. The original inline
-- column check was named events_recurrence_check by Postgres; drop either name
-- (idempotent) before adding the replacement.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_recurrence_check;
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_recurrence;
ALTER TABLE events ADD CONSTRAINT chk_events_recurrence
  CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'yearly'));
