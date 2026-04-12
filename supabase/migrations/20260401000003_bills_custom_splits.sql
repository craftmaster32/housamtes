-- ============================================================
-- HouseMates — Add custom split amounts to bills
-- ============================================================

-- split_amounts stores per-person amounts when using custom split.
-- NULL = equal split (use amount / split_between.length).
-- JSON shape: { "Alex": 60.00, "Sam": 40.00, "Jordan": 20.00 }

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS split_amounts jsonb;
