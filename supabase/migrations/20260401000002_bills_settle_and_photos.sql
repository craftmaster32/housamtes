-- ============================================================
-- HouseMates — Add settle fields to bills + photos table
-- ============================================================

-- Add settle tracking columns to bills
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS settled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settled_by    text,
  ADD COLUMN IF NOT EXISTS settled_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_bills_settled ON bills(settled);

-- ── Photos table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS photos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  url          text NOT NULL,
  caption      text,
  category     text NOT NULL DEFAULT 'general' CHECK (category IN ('receipts','damage','memories','general')),
  uploaded_by  text NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_house_id ON photos(house_id);
CREATE INDEX IF NOT EXISTS idx_photos_user_id  ON photos(user_id);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house members can read photos"
  ON photos FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can upload photos"
  ON photos FOR INSERT
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "users can delete own photos"
  ON photos FOR DELETE
  USING (user_id = auth.uid());
