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

-- For weekly repeats, the weekdays it lands on (0 = Sunday … 6 = Saturday),
-- e.g. {1,4} = every Monday and Thursday. Null/empty = the base date's weekday.
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_days smallint[];

-- Every listed weekday must be a valid 0–6 index.
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_recurrence_days;
ALTER TABLE events ADD CONSTRAINT chk_events_recurrence_days
  CHECK (
    recurrence_days IS NULL
    OR (recurrence_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[])
  );
