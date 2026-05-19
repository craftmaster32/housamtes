-- Add draft expiry timestamp to grocery_items.
-- Draft items that are never shared expire and can be cleaned up after 24 hours.

ALTER TABLE grocery_items
  ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_grocery_draft_expires
  ON grocery_items(draft_expires_at)
  WHERE draft_expires_at IS NOT NULL;
