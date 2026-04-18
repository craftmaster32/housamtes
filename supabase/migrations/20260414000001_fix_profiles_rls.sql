-- ============================================================
-- Fix profiles SELECT policy — remove double-nested house_members subquery
-- ============================================================
-- The original "users can read all profiles in their house" policy used:
--
--   id IN (
--     SELECT user_id FROM house_members
--     WHERE house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
--   )
--
-- This double-nested self-referential subquery on house_members is evaluated
-- against the house_members RLS policy, which itself calls get_my_house_ids().
-- The combination causes PostgreSQL to return 0 rows for all profile reads —
-- meaning members cannot see each other even when they are in the same house.
--
-- Fix: use get_my_house_ids() directly (one level, SECURITY DEFINER, no loop).
-- Also add an explicit own-profile clause so users can always read themselves.

DROP POLICY IF EXISTS "users can read all profiles in their house" ON profiles;
DROP POLICY IF EXISTS "house members can read profiles" ON profiles;

CREATE POLICY "house members can read profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM house_members
      WHERE house_id IN (SELECT public.get_my_house_ids())
    )
  );

-- Ensure the helper function is executable by all authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_house_ids() TO authenticated, anon;
