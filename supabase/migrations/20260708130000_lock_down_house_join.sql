-- ============================================================
-- Lock down house discovery and joining
-- ============================================================
-- Problem: the "authenticated users can find house by invite code" policy
-- let ANY signed-in user read EVERY house row — including names and invite
-- codes. Combined with the house_members INSERT policy (which only checked
-- user_id = auth.uid()), any account could list all houses and add itself
-- to any of them, gaining full access to that house's bills, chat, photos.
--
-- Fix:
--   1. Drop the open SELECT policy on houses.
--   2. Let creators read their own house (needed for INSERT ... RETURNING
--      during house creation, and for the membership INSERT check below).
--   3. Only house creators may insert their own membership row directly.
--   4. Joining by invite code moves to two SECURITY DEFINER RPCs that
--      require the exact code — no browsing, no direct inserts.
--      As a bonus the preview RPC returns the real member count, which the
--      old client could never see (RLS hid house_members from non-members).

-- 1. Remove the open read policy
DROP POLICY IF EXISTS "authenticated users can find house by invite code" ON houses;

-- 2. Creators can always read their own house (even before their
--    house_members row exists — the bootstrap moment during creation)
DROP POLICY IF EXISTS "creator can read own house" ON houses;
CREATE POLICY "creator can read own house"
  ON houses FOR SELECT
  USING (created_by = auth.uid());

-- 3. Direct membership inserts: only the creator adding themselves
DROP POLICY IF EXISTS "users can join a house (insert own row)" ON house_members;
DROP POLICY IF EXISTS "house creator can insert own membership" ON house_members;
CREATE POLICY "house creator can insert own membership"
  ON house_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM houses WHERE id = house_id AND created_by = auth.uid())
  );

-- 4a. Preview a house by exact invite code (name + member count only)
CREATE OR REPLACE FUNCTION public.find_house_by_invite_code(p_code text)
RETURNS TABLE (house_id uuid, house_name text, member_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN QUERY
    SELECT h.id,
           h.name,
           (SELECT count(*)::integer FROM house_members m WHERE m.house_id = h.id)
    FROM houses h
    WHERE h.invite_code = upper(trim(p_code));
END;
$$;

-- 4b. Join a house by exact invite code (validate + insert atomically)
CREATE OR REPLACE FUNCTION public.join_house_by_invite_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_house_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT h.id INTO v_house_id FROM houses h WHERE h.invite_code = upper(trim(p_code));
  IF v_house_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  INSERT INTO house_members (house_id, user_id)
  VALUES (v_house_id, auth.uid())
  ON CONFLICT (house_id, user_id) DO NOTHING;
  RETURN v_house_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_house_by_invite_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_house_by_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_house_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_house_by_invite_code(text) TO authenticated;
