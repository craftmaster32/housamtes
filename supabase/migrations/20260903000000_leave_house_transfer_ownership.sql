-- ============================================================
-- Leaving a house: keep an owner, never orphan the house
-- ============================================================
-- Problem: leaving a house was a bare DELETE of the caller's house_members
-- row. Two situations were unhandled:
--   1. The owner leaves — the house could be left with NO owner, so nobody
--      could manage roles, the timezone, or other owner-only actions.
--   2. The last member leaves — the houses row (and all its data) lingered
--      as an unreachable ghost.
--
-- Fix: a SECURITY DEFINER RPC that removes the caller's membership and then,
-- atomically:
--   - if no members remain, deletes the house (FK cascades clean up its data);
--   - else, if the leaver was the only owner, promotes a replacement —
--     preferring an existing admin, otherwise the longest-standing member.

CREATE OR REPLACE FUNCTION public.leave_house()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_house_id  uuid;
  v_role      text;
  v_remaining integer;
  v_new_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The member's current house (most recently joined wins, matching the client).
  SELECT house_id, role
    INTO v_house_id, v_role
    FROM house_members
   WHERE user_id = v_uid
   ORDER BY joined_at DESC
   LIMIT 1;

  IF v_house_id IS NULL THEN
    RETURN; -- not in a house; nothing to do
  END IF;

  -- Remove the caller's membership.
  DELETE FROM house_members
   WHERE user_id = v_uid
     AND house_id = v_house_id;

  SELECT count(*) INTO v_remaining
    FROM house_members
   WHERE house_id = v_house_id;

  -- Last one out: delete the empty house (ON DELETE CASCADE clears its data).
  IF v_remaining = 0 THEN
    DELETE FROM houses WHERE id = v_house_id;
    RETURN;
  END IF;

  -- The owner left and no owner remains — promote a replacement.
  IF v_role = 'owner'
     AND NOT EXISTS (
       SELECT 1 FROM house_members
        WHERE house_id = v_house_id AND role = 'owner'
     )
  THEN
    SELECT user_id
      INTO v_new_owner
      FROM house_members
     WHERE house_id = v_house_id
     ORDER BY (role = 'admin') DESC, joined_at ASC
     LIMIT 1;

    IF v_new_owner IS NOT NULL THEN
      UPDATE house_members
         SET role = 'owner'
       WHERE house_id = v_house_id
         AND user_id = v_new_owner;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_house() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_house() TO authenticated;
