-- Add personal list support to grocery_items.
-- Personal items are visible only to the user who created them (enforced by RLS).

ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_grocery_personal ON grocery_items(added_by) WHERE is_personal = true;

-- SELECT: shared items visible to all house members; personal items visible only to their creator
DROP POLICY IF EXISTS "house members can read grocery" ON grocery_items;
CREATE POLICY "house members can read grocery"
  ON grocery_items FOR SELECT
  USING (
    (is_personal = false AND house_id IN (
      SELECT house_id FROM house_members WHERE user_id = auth.uid()
    ))
    OR
    (is_personal = true AND added_by = auth.uid())
  );

-- UPDATE: same isolation — personal items editable only by their creator
DROP POLICY IF EXISTS "house members can update grocery" ON grocery_items;
CREATE POLICY "house members can update grocery"
  ON grocery_items FOR UPDATE
  USING (
    (is_personal = false AND house_id IN (
      SELECT house_id FROM house_members WHERE user_id = auth.uid()
    ))
    OR
    (is_personal = true AND added_by = auth.uid())
  );

-- DELETE: same isolation
DROP POLICY IF EXISTS "house members can delete grocery" ON grocery_items;
CREATE POLICY "house members can delete grocery"
  ON grocery_items FOR DELETE
  USING (
    (is_personal = false AND house_id IN (
      SELECT house_id FROM house_members WHERE user_id = auth.uid()
    ))
    OR
    (is_personal = true AND added_by = auth.uid())
  );