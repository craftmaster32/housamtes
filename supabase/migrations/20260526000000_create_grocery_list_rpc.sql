-- Atomic creation of a grocery list + its items.
-- Replaces the two-step client-side insert + manual rollback, so either both
-- tables are written or neither is (PostgreSQL function = implicit transaction).

CREATE OR REPLACE FUNCTION create_grocery_list(
  p_house_id   uuid,
  p_name       text,
  p_created_by text,
  p_is_private boolean,
  p_items      jsonb DEFAULT '[]'::jsonb
)
RETURNS grocery_lists
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
DECLARE
  new_list grocery_lists;
BEGIN
  IF p_created_by IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'forbidden: cannot create a list for another user';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'invalid_name: list name must not be blank';
  END IF;

  INSERT INTO grocery_lists (house_id, name, created_by, is_private)
  VALUES (p_house_id, btrim(p_name), p_created_by, p_is_private)
  RETURNING * INTO new_list;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items: p_items must be a JSON array';
  END IF;

  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_items) AS item
      WHERE item->>'name' IS NULL OR btrim(item->>'name') = ''
    ) THEN
      RAISE EXCEPTION 'invalid_item: every grocery list item must have a non-empty name';
    END IF;

    INSERT INTO grocery_list_items (list_id, name, quantity, position)
    SELECT
      new_list.id,
      btrim(item->>'name'),
      COALESCE(item->>'quantity', ''),
      CASE WHEN item->>'position' ~ '^\d+$' THEN (item->>'position')::integer ELSE 0 END
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN new_list;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_grocery_list(uuid, text, text, boolean, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION create_grocery_list(uuid, text, text, boolean, jsonb) TO authenticated;
