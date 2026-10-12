-- "Still on the list?" reminders for grocery items.
-- When an item has been waiting on the list for 72+ hours without being
-- bought, the grocery-reminder-check Edge Function sends one push nudging the
-- house to buy it or remove it. stale_notified_at records that the nudge went
-- out, so each item is only ever nudged once.

ALTER TABLE grocery_items
  ADD COLUMN IF NOT EXISTS stale_notified_at timestamptz;

-- Speeds up the cron scan:
--   WHERE stale_notified_at IS NULL AND is_checked = false AND is_draft = false
--     AND created_at <= now() - interval '72 hours'
CREATE INDEX IF NOT EXISTS idx_grocery_items_stale_scan
  ON grocery_items(created_at)
  WHERE stale_notified_at IS NULL AND is_checked = false AND is_draft = false;

-- Speeds up the "already nudged this house today?" check.
CREATE INDEX IF NOT EXISTS idx_grocery_items_stale_notified
  ON grocery_items(house_id, stale_notified_at)
  WHERE stale_notified_at IS NOT NULL;

-- Per-person opt-out, on by default like every other notification.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_grocery_stale boolean DEFAULT true;

-- Candidate items for the nudge, chosen in one query so no house can crowd
-- out another:
--   • only houses where it's currently daytime (house timezone; an unknown
--     timezone counts as UTC),
--   • skipping houses already nudged since p_cooldown_since,
--   • at most p_per_house of each house's oldest waiting items.
-- Called only by the grocery-reminder-check Edge Function (service role).
CREATE OR REPLACE FUNCTION grocery_stale_candidates(
  p_now            timestamptz,
  p_cutoff         timestamptz,
  p_cooldown_since timestamptz,
  p_from_hour      integer,
  p_until_hour     integer,
  p_per_house      integer
)
RETURNS TABLE (id uuid, house_id uuid, name text, added_by text, is_personal boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH tz AS MATERIALIZED (
    SELECT name FROM pg_timezone_names
  ),
  house_hours AS (
    SELECT h.id,
           extract(hour FROM p_now AT TIME ZONE coalesce(tz.name, 'UTC'))::integer AS local_hour
    FROM houses h
    LEFT JOIN tz ON tz.name = h.timezone
  ),
  daytime AS (
    SELECT hh.id
    FROM house_hours hh
    WHERE hh.local_hour >= p_from_hour
      AND hh.local_hour < p_until_hour
      AND NOT EXISTS (
        SELECT 1 FROM grocery_items r
        WHERE r.house_id = hh.id AND r.stale_notified_at >= p_cooldown_since
      )
  ),
  ranked AS (
    SELECT gi.id, gi.house_id, gi.name, gi.added_by, gi.is_personal,
           row_number() OVER (PARTITION BY gi.house_id ORDER BY gi.created_at, gi.id) AS rn
    FROM grocery_items gi
    JOIN daytime d ON d.id = gi.house_id
    WHERE gi.stale_notified_at IS NULL
      AND gi.is_checked = false
      AND gi.is_draft = false
      AND gi.created_at <= p_cutoff
  )
  SELECT ranked.id, ranked.house_id, ranked.name, ranked.added_by, ranked.is_personal
  FROM ranked
  WHERE ranked.rn <= p_per_house
  ORDER BY ranked.house_id, ranked.rn;
$$;

REVOKE ALL ON FUNCTION grocery_stale_candidates(timestamptz, timestamptz, timestamptz, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION grocery_stale_candidates(timestamptz, timestamptz, timestamptz, integer, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION grocery_stale_candidates(timestamptz, timestamptz, timestamptz, integer, integer, integer) TO service_role;
