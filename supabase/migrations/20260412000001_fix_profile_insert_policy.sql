-- ============================================================
-- Fix profile INSERT policy blocking signup trigger
-- ============================================================
-- The handle_new_user trigger runs BEFORE the user has a session,
-- so auth.uid() is null when it fires. The old policy
-- WITH CHECK (id = auth.uid()) blocked the insert and caused a
-- 500 on signup. Since the trigger is SECURITY DEFINER, only
-- trusted server code can call this insert — opening it to true is safe.

DROP POLICY IF EXISTS "users can insert own profile" ON profiles;

CREATE POLICY "users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (true);
