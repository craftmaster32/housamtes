-- ============================================================
-- Rebrand the settled-bill delete guard message: Nestiq → HouseMates
-- ============================================================
-- The error a user sees when trying to delete a settled bill still
-- referenced the old "Nestiq" name. Re-create the function with the
-- current brand. CREATE OR REPLACE updates the live function in place —
-- the trigger keeps pointing at it, so nothing else changes.

CREATE OR REPLACE FUNCTION fn_block_settled_bill_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.settled = true THEN
    RAISE EXCEPTION
      'Settled bills cannot be deleted — settlement history is permanent. '
      'Contact HouseMates support if you believe this record is in error.';
  END IF;
  RETURN OLD;
END;
$$;
