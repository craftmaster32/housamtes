-- ============================================================
-- Allow owners/admins to delete default expense categories
-- ============================================================
-- The original delete policy only allowed removing custom categories
-- (is_default = false), so the seeded defaults could never be removed
-- from Settings → Categories. Owners and admins should be able to tidy
-- up categories they don't use. Deleting a category only removes the
-- row here — existing bills keep their category text, so nothing breaks.

DROP POLICY IF EXISTS "owner or admin delete categories" ON expense_categories;

CREATE POLICY "owner or admin delete categories"
  ON expense_categories FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
