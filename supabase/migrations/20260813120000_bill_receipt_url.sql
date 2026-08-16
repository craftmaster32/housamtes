-- ============================================================
-- Nestiq — Attach an optional receipt photo to a bill
-- ============================================================
-- A shopping trip (or quick buy) can save a receipt photo. The image itself
-- lives in the private `house-photos` storage bucket (and, when saved from a
-- shopping trip, also gets a row in the `photos` table under the 'receipts'
-- category). This column stores the canonical bucket URL so the bill's detail
-- screen can sign and display the same object — no duplicate upload.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS receipt_url text;
