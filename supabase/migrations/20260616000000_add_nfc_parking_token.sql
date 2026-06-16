-- Add a long-lived NFC token to profiles for the parking-toggle edge function.
-- One UUID token per user, auto-generated and never expires.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nfc_parking_token uuid DEFAULT gen_random_uuid();

-- Backfill any existing rows that landed with NULL (shouldn't happen, but be safe)
UPDATE profiles SET nfc_parking_token = gen_random_uuid() WHERE nfc_parking_token IS NULL;

ALTER TABLE profiles ALTER COLUMN nfc_parking_token SET NOT NULL;

-- Unique index so the edge function can look up the owner unambiguously in O(1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nfc_parking_token ON profiles(nfc_parking_token);

-- RPC: allows a user to rotate their own NFC token from the app settings screen.
-- Returns the new token so the client can display it immediately.
CREATE OR REPLACE FUNCTION reset_nfc_parking_token(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_token uuid;
BEGIN
  -- Users can only reset their own token
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_new_token := gen_random_uuid();

  UPDATE profiles
    SET nfc_parking_token = v_new_token
  WHERE id = p_user_id;

  RETURN v_new_token;
END;
$$;
