-- ============================================================
-- Nestiq — Remember how a bill was split (equal / custom / %)
-- ============================================================
-- split_amounts stores the resolved per-person amounts, but a percentage
-- split ends up looking identical to a custom one once resolved — so the
-- edit screen couldn't tell them apart and reopened every non-equal bill as
-- "custom". split_type records the method the payer actually chose so the
-- edit form can restore the right mode.
--
-- Values: 'equal' | 'custom' | 'percentage'. NULL for bills created before
-- this column existed — the app falls back to inferring from split_amounts.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS split_type text
  CHECK (split_type IS NULL OR split_type IN ('equal', 'custom', 'percentage'));
