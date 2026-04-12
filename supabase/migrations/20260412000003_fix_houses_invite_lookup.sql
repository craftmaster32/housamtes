-- ============================================================
-- Allow authenticated users to look up a house by invite code
-- ============================================================
-- The original SELECT policy on houses only allowed reading houses
-- you were already a member of. This blocked new users from finding
-- a house by its invite code in order to join it.
-- Any authenticated user can now read houses — RLS on house_members
-- still controls who can actually join.

DROP POLICY IF EXISTS "authenticated users can find house by invite code" ON houses;
CREATE POLICY "authenticated users can find house by invite code"
  ON houses FOR SELECT
  USING (auth.uid() IS NOT NULL);
