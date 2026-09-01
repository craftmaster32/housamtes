-- ============================================================
-- HouseMates — Per-subscription language for web push
-- Mirrors push_tokens.language so the send-push Edge Function can
-- localize instant "a housemate did X" notifications for browser
-- recipients too, not just native devices. Defaults to English.
-- ============================================================

ALTER TABLE web_push_subscriptions
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
