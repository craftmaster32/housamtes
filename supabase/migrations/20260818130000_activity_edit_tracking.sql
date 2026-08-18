-- Track who last edited a shared record and when, so genuine edits (not
-- settles, toggles or completions) can surface in the house activity bell.
--
-- These columns are set ONLY by the app's edit actions (editBill, updateBill,
-- updatePayment, grocery updateItem, note edit). They are deliberately separate
-- from `updated_at`, which every mutation bumps — reusing updated_at would make
-- settling a bill or ticking off a grocery item look like an "edit".
--
-- edited_by is a plain uuid with no FK: it is display metadata for the feed, and
-- must survive a member leaving without cascading or blocking the edit.

ALTER TABLE bills               ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE bills               ADD COLUMN IF NOT EXISTS edited_by uuid;

ALTER TABLE recurring_bills     ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE recurring_bills     ADD COLUMN IF NOT EXISTS edited_by uuid;

ALTER TABLE household_payments  ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE household_payments  ADD COLUMN IF NOT EXISTS edited_by uuid;

ALTER TABLE grocery_items       ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE grocery_items       ADD COLUMN IF NOT EXISTS edited_by uuid;

ALTER TABLE announcements       ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE announcements       ADD COLUMN IF NOT EXISTS edited_by uuid;
