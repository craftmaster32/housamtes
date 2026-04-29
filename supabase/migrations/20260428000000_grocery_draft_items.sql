-- Add draft support to grocery_items.
-- Draft items (is_personal=true, is_draft=true) are composed privately by one user
-- and published all at once to the shared list when they tap "Done".
-- Private items (is_personal=true, is_draft=false) stay private forever.
-- Shared items (is_personal=false, is_draft=false) are visible to all house members.

ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_grocery_draft ON grocery_items(added_by) WHERE is_draft = true;
