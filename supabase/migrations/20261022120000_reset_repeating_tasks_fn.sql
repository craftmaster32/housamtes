-- Bulk-reset repeating tasks, restricted to house owners and admins.
-- Called from the client via supabase.rpc('reset_repeating_tasks', { p_house_id }).
-- SECURITY DEFINER runs with the function owner's privileges so it can bypass
-- the broad member UPDATE policy, while still using auth.uid() for the role check.

CREATE OR REPLACE FUNCTION reset_repeating_tasks(p_house_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM house_members
    WHERE house_id = p_house_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied: only house admins may reset repeating tasks';
  END IF;

  UPDATE house_tasks
  SET is_done = false, completed_at = NULL, completed_by = NULL
  WHERE house_id = p_house_id
    AND recurrence <> 'once';
END;
$$;

REVOKE ALL ON FUNCTION reset_repeating_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_repeating_tasks(uuid) TO authenticated;
