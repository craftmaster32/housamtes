-- Add currency column to houses so server-side edge functions (e.g. bill-due-reminder)
-- can format amounts with the correct symbol instead of hardcoding ₪.
ALTER TABLE houses ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT '₪';
