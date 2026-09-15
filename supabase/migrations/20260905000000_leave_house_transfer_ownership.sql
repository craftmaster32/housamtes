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
--   - else, if the leaver was the only owner, hands ownership to a replacement.
--     A leaving owner may name their successor (p_new_owner, a fellow member);
--     otherwise one is chosen automatically — an existing admin first, else the
--     longest-standing member.

DROP FUNCTION IF EXISTS public.leave_house();
DROP FUNCTION IF EXISTS public.leave_house(uuid);
DROP FUNCTION IF EXISTS public.leave_house(uuid, uuid);

CREATE OR REPLACE FUNCTION public.leave_house(p_house_id uuid, p_new_owner uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_house_id  uuid := p_house_id;
  v_role      text;
  v_remaining integer;
  v_new_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_house_id IS NULL THEN
    RAISE EXCEPTION 'A house id is required';
  END IF;

  -- Serialize concurrent leaves/role changes for this house so two owners
  -- leaving at once can't both pass the "keep an owner" reasoning on a stale
  -- view of the membership. Taken before we read the membership below.
  PERFORM 1 FROM houses WHERE id = v_house_id FOR UPDATE;

  -- The caller's role *in the house they asked to leave*. A user can belong to
  -- several houses, so we scope strictly to p_house_id rather than guessing the
  -- "current" one — otherwise leaving from Settings could act on the wrong house.
  SELECT role
    INTO v_role
    FROM house_members
   WHERE user_id = v_uid
     AND house_id = v_house_id;

  IF NOT FOUND THEN
    RETURN; -- not a member of this house; nothing to do
  END IF;

  -- A leaving owner may hand ownership to a chosen fellow member up front.
  IF v_role = 'owner'
     AND p_new_owner IS NOT NULL
     AND p_new_owner <> v_uid
     AND EXISTS (
       SELECT 1 FROM house_members
        WHERE house_id = v_house_id AND user_id = p_new_owner
     )
  THEN
    UPDATE house_members
       SET role = 'owner'
     WHERE house_id = v_house_id AND user_id = p_new_owner;
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

REVOKE ALL ON FUNCTION public.leave_house(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_house(uuid, uuid) TO authenticated;
