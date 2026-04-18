-- ============================================================
-- Add direct FK from house_members.user_id to profiles.id
-- ============================================================
-- house_members.user_id already references auth.users(id), and
-- profiles.id also references auth.users(id). However PostgREST
-- cannot traverse this two-hop relationship to resolve the
-- embedded join "profiles(...)" from house_members — it needs a
-- direct FK between the two public tables.
--
-- With this constraint:
--   • PostgREST can find house_members → profiles via user_id
--   • Deleting a profile cascades to remove the membership row
--   • Every future join .select('..., profiles(...)') works

ALTER TABLE house_members
  ADD CONSTRAINT house_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
