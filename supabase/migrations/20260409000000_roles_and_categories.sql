-- ============================================================
-- Nestiq — Roles, permissions & custom expense categories
-- ============================================================

-- ── 1. Add role column to house_members ─────────────────────
ALTER TABLE house_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'admin', 'member'));

-- Promote existing house creators to owner
UPDATE house_members hm
SET role = 'owner'
FROM houses h
WHERE hm.house_id = h.id
  AND hm.user_id  = h.created_by
  AND hm.role = 'member';

-- ── 2. Add per-member permissions (JSONB) ───────────────────
ALTER TABLE house_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
    "bills":       true,
    "grocery":     true,
    "parking":     true,
    "chores":      true,
    "chat":        true,
    "photos":      true,
    "voting":      true,
    "maintenance": true,
    "condition":   true
  }';

CREATE INDEX IF NOT EXISTS idx_house_members_role ON house_members(role);

-- ── 3. Expense categories table ─────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id    uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT '📦',
  color       text NOT NULL DEFAULT '#8D8F8F',
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  int  NOT NULL DEFAULT 99,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(house_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_house_id ON expense_categories(house_id);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read categories"
  ON expense_categories FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "members insert categories"
  ON expense_categories FOR INSERT
  WITH CHECK (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "members update categories"
  ON expense_categories FOR UPDATE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "owner or admin delete categories"
  ON expense_categories FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    AND is_default = false
  );
