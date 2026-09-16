-- ============================================================
-- Managing member roles and permissions safely (server-side)
-- ============================================================
-- house_members has RLS enabled but no UPDATE policy, so the app's direct
-- role/permission updates never actually persisted. Move both to SECURITY
-- DEFINER RPCs that (a) do persist and (b) enforce who may do what:
--   - only an owner may grant or revoke the owner role (co-owners), or touch
--     another owner;
--   - the house can never be left without at least one owner;
--   - owners and admins may edit a member's feature permissions.

-- Change a member's role.
CREATE OR REPLACE FUNCTION public.set_member_role(p_member_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_house_id    uuid;
  v_old_role    text;
  v_caller_role text;
  v_owner_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT house_id, role INTO v_house_id, v_old_role
    FROM house_members WHERE id = p_member_id;
  IF v_house_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Serialize role changes for this house so two concurrent demotions can't
  -- both pass the last-owner check on a stale count.
  PERFORM 1 FROM houses WHERE id = v_house_id FOR UPDATE;

  -- The caller must manage this house.
  SELECT role INTO v_caller_role
    FROM house_members
   WHERE house_id = v_house_id AND user_id = v_uid;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_old_role = p_role THEN
    RETURN; -- nothing to do
  END IF;

  -- Only an owner may grant or revoke the owner role, or change an owner.
  IF (p_role = 'owner' OR v_old_role = 'owner') AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only an owner can change owner status';
  END IF;

  -- Never demote the last remaining owner.
  IF v_old_role = 'owner' AND p_role <> 'owner' THEN
    SELECT count(*) INTO v_owner_count
      FROM house_members
     WHERE house_id = v_house_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'The house must keep at least one owner';
    END IF;
  END IF;

  UPDATE house_members SET role = p_role WHERE id = p_member_id;
END;
$$;

-- Update a member's per-feature permissions.
CREATE OR REPLACE FUNCTION public.set_member_permissions(p_member_id uuid, p_permissions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_house_id    uuid;
  v_caller_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT house_id INTO v_house_id FROM house_members WHERE id = p_member_id;
  IF v_house_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT role INTO v_caller_role
    FROM house_members
   WHERE house_id = v_house_id AND user_id = v_uid;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE house_members SET permissions = p_permissions WHERE id = p_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_member_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_permissions(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_permissions(uuid, jsonb) TO authenticated;
