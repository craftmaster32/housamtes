-- ============================================================
-- Fix self-referential RLS loop on house_members
-- ============================================================
-- The original "house members can read membership" policy used:
--   USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()))
-- This is self-referential: the subquery on house_members also triggers
-- the same policy, causing Postgres to resolve it as 0 rows. The result:
--   - fetchMemberData() always returns null → users lose their houseId
--   - Members cannot see each other
--   - All other tables whose policies query house_members also break
--
-- Fix: a SECURITY DEFINER helper function that reads house_members
-- without going through RLS, breaking the circular dependency.

CREATE OR REPLACE FUNCTION public.get_my_house_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT house_id FROM public.house_members WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "house members can read membership" ON house_members;
CREATE POLICY "house members can read membership"
  ON house_members FOR SELECT
  USING (house_id IN (SELECT public.get_my_house_ids()));

-- The houses table had the same loop: its SELECT policy queried house_members
-- which triggered the house_members policy recursively.
DROP POLICY IF EXISTS "house members can read their house" ON houses;
CREATE POLICY "house members can read their house"
  ON houses FOR SELECT
  USING (id IN (SELECT public.get_my_house_ids()));
