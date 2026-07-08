-- ============================================================
-- Stop housemates reading each other's NFC parking token
-- ============================================================
-- Problem: the profiles SELECT policy lets house members read each other's
-- entire profile row — including nfc_parking_token. That token is a
-- long-lived credential for the parking-toggle edge function, so any
-- housemate could impersonate another to claim/release the parking spot.
--
-- Fix: switch profiles to column-level SELECT grants that exclude
-- nfc_parking_token, and expose the caller's OWN token through a
-- SECURITY DEFINER RPC used by the settings screen.
-- (The parking-toggle edge function uses the service role and is unaffected.)

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, name, avatar_color, avatar_url, cover_url, created_at, updated_at)
  ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_nfc_parking_token()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT nfc_parking_token FROM profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_nfc_parking_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_nfc_parking_token() TO authenticated;
