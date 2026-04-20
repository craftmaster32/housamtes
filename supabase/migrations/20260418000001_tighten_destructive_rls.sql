-- ============================================================
-- Tighten destructive RLS: owner/admin only for sensitive deletes
-- Bills (financial records), proposals (votes), condition entries (move-in/out docs)
-- are permanent records that any member could previously delete.
-- Regular members retain full read + insert + update access.
-- ============================================================

-- ── BILLS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "house members can delete bills" ON bills;

CREATE POLICY "owner or admin can delete bills"
  ON bills FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── PROPOSALS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "house members can delete proposals" ON proposals;

CREATE POLICY "owner or admin can delete proposals"
  ON proposals FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── CONDITION ENTRIES ────────────────────────────────────────
DROP POLICY IF EXISTS "house members can delete condition" ON condition_entries;

CREATE POLICY "owner or admin can delete condition entries"
  ON condition_entries FOR DELETE
  USING (
    house_id IN (
      SELECT house_id FROM house_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
