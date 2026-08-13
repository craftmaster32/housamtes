-- Atomic edit of a saved grocery list: replace its items and optionally update
-- its name / privacy in a single transaction. Replaces the previous multi-step
-- client-side delete + insert + update, so a mid-write failure can never leave
-- the list's items and metadata out of sync (PostgreSQL function = implicit
-- transaction).
--
-- p_name / p_is_private are NULL when the caller only edits items, in which case
-- the existing values are kept.

CREATE OR REPLACE FUNCTION update_grocery_list(
  p_list_id    uuid,
  p_items      jsonb   DEFAULT '[]'::jsonb,
  p_name       text    DEFAULT NULL,
  p_is_private boolean DEFAULT NULL
)
RETURNS grocery_lists
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
DECLARE
  updated_list grocery_lists;
BEGIN
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items: p_items must be a JSON array';
  END IF;

  IF p_name IS NOT NULL AND btrim(p_name) = '' THEN
    RAISE EXCEPTION 'invalid_name: list name must not be blank';
  END IF;

  -- Update metadata first: this also enforces existence + RLS. If no row is
  -- visible/updatable, updated_list stays NULL and we abort before deleting
  -- anything.
  UPDATE grocery_lists
  SET name       = COALESCE(NULLIF(btrim(p_name), ''), name),
      is_private = COALESCE(p_is_private, is_private),
      updated_at = now()
  WHERE id = p_list_id
  RETURNING * INTO updated_list;

  IF updated_list.id IS NULL THEN
    RAISE EXCEPTION 'not_found: grocery list does not exist or is not accessible';
  END IF;

  DELETE FROM grocery_list_items WHERE list_id = p_list_id;

  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_items) AS item
      WHERE item->>'name' IS NULL OR btrim(item->>'name') = ''
    ) THEN
      RAISE EXCEPTION 'invalid_item: every grocery list item must have a non-empty name';
    END IF;

    INSERT INTO grocery_list_items (list_id, name, quantity, position)
    SELECT
      p_list_id,
      btrim(item->>'name'),
      COALESCE(item->>'quantity', ''),
      CASE WHEN item->>'position' ~ '^\d+$' THEN (item->>'position')::integer ELSE 0 END
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN updated_list;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_grocery_list(uuid, jsonb, text, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION update_grocery_list(uuid, jsonb, text, boolean) TO authenticated;
