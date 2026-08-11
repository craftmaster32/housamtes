-- ============================================================
-- HouseMates — Daily dad-joke notification preference
-- One playful joke a day; opt-out lives with the other
-- per-user notification preferences. Defaults to on.
-- ============================================================

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_daily_joke boolean NOT NULL DEFAULT true;
