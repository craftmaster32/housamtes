-- Add personal list support to grocery_items.
-- Personal items are visible only to the user who created them (enforced by RLS).
-- Personal items are also scoped to current house membership so ex-members lose access.

ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_grocery_personal ON grocery_items(added_by) WHERE is_personal = true;

-- SELECT: shared items visible to all house members;
--         personal items visible only to their creator AND only while still a member
DROP POLICY IF EXISTS "house members can read grocery" ON grocery_items;
CREATE POLICY "house members can read grocery"
  ON grocery_items FOR SELECT
  USING (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND (is_personal = false OR added_by = auth.uid())
  );

-- INSERT: any house member may insert; personal items must declare themselves as owner
DROP POLICY IF EXISTS "house members can insert grocery" ON grocery_items;
CREATE POLICY "house members can insert grocery"
  ON grocery_items FOR INSERT
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND (is_personal = false OR added_by = auth.uid())
  );

-- UPDATE: shared items editable by any house member; personal items only by creator
DROP POLICY IF EXISTS "house members can update grocery" ON grocery_items;
CREATE POLICY "house members can update grocery"
  ON grocery_items FOR UPDATE
  USING (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND (is_personal = false OR added_by = auth.uid())
  );

-- DELETE: same isolation as UPDATE
DROP POLICY IF EXISTS "house members can delete grocery" ON grocery_items;
CREATE POLICY "house members can delete grocery"
  ON grocery_items FOR DELETE
  USING (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND (is_personal = false OR added_by = auth.uid())
  );
