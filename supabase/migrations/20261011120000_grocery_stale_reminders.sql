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
