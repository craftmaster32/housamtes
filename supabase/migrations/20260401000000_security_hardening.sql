-- ============================================================
-- Nestiq — Security Hardening
-- Fixes missing RLS policies and tightens existing ones
-- ============================================================

-- ── HOUSES: missing INSERT and DELETE policies ───────────────
-- Without an INSERT policy, authenticated users cannot create houses
-- at all (RLS blocks by default). This policy allows any authenticated
-- user to create a house, but only if they set themselves as creator.
CREATE POLICY "authenticated users can create a house"
  ON houses FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only the house creator can delete the house.
CREATE POLICY "creator can delete house"
  ON houses FOR DELETE
  USING (auth.uid() = created_by);

-- ── PROFILES: missing DELETE policy ─────────────────────────
-- Users can delete their own profile (needed for account deletion).
CREATE POLICY "users can delete own profile"
  ON profiles FOR DELETE
  USING (id = auth.uid());

-- ── HOUSE_MEMBERS: tighten member removal ───────────────────
-- The existing DELETE policy only lets users remove themselves.
-- This adds a separate policy so the house creator can also
-- remove any member (needed for admin/moderation).
CREATE POLICY "house creator can remove members"
  ON house_members FOR DELETE
  USING (
    house_id IN (SELECT id FROM houses WHERE created_by = auth.uid())
  );
