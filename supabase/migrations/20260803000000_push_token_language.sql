-- ============================================================
-- HouseMates — Per-device language for push notifications
-- Lets reminder Edge Functions localize (and punnify) the copy
-- in each recipient's chosen language. Defaults to English.
-- ============================================================

ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
