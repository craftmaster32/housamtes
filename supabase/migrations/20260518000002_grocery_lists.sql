-- Saved grocery list templates.
-- A list is a reusable named collection of items that can be loaded into
-- a user's draft, edited, and shared. Public lists are visible to all house
-- members; private lists are only visible to their creator.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grocery_lists (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id    uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_by  text NOT NULL,
  is_private  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grocery_list_items (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id    uuid NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  name       text NOT NULL,
  quantity   text DEFAULT '',
  position   integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_grocery_lists_house_id
  ON grocery_lists(house_id);

CREATE INDEX IF NOT EXISTS idx_grocery_lists_created_by
  ON grocery_lists(created_by);

CREATE INDEX IF NOT EXISTS idx_grocery_list_items_list_id
  ON grocery_list_items(list_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_list_items ENABLE ROW LEVEL SECURITY;

-- grocery_lists: any house member can read public lists; only creator sees private
CREATE POLICY "house members can read grocery lists" ON grocery_lists FOR SELECT
  USING (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND (is_private = false OR created_by = auth.uid()::text)
  );

-- Any house member can create a list
CREATE POLICY "house members can create grocery lists" ON grocery_lists FOR INSERT
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
  );

-- Any house member can update public lists; only creator can update private
CREATE POLICY "house members can update grocery lists" ON grocery_lists FOR UPDATE
  USING (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND (is_private = false OR created_by = auth.uid()::text)
  );

-- Only creator can delete their list
CREATE POLICY "creator can delete grocery lists" ON grocery_lists FOR DELETE
  USING (
    created_by = auth.uid()::text
    AND house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
  );

-- grocery_list_items: access mirrors the parent list's visibility rules
CREATE POLICY "house members can read grocery list items" ON grocery_list_items FOR SELECT
  USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      INNER JOIN house_members hm ON hm.house_id = gl.house_id
      WHERE hm.user_id = auth.uid()
        AND (gl.is_private = false OR gl.created_by = auth.uid()::text)
    )
  );

CREATE POLICY "house members can insert grocery list items" ON grocery_list_items FOR INSERT
  WITH CHECK (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      INNER JOIN house_members hm ON hm.house_id = gl.house_id
      WHERE hm.user_id = auth.uid()
        AND (gl.is_private = false OR gl.created_by = auth.uid()::text)
    )
  );

CREATE POLICY "house members can update grocery list items" ON grocery_list_items FOR UPDATE
  USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      INNER JOIN house_members hm ON hm.house_id = gl.house_id
      WHERE hm.user_id = auth.uid()
        AND (gl.is_private = false OR gl.created_by = auth.uid()::text)
    )
  );

CREATE POLICY "house members can delete grocery list items" ON grocery_list_items FOR DELETE
  USING (
    list_id IN (
      SELECT gl.id FROM grocery_lists gl
      INNER JOIN house_members hm ON hm.house_id = gl.house_id
      WHERE hm.user_id = auth.uid()
        AND (gl.is_private = false OR gl.created_by = auth.uid()::text)
    )
  );
