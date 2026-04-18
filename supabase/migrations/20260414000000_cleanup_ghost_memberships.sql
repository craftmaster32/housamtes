-- ============================================================
-- Remove stale house_members rows that point to deleted houses
-- ============================================================
-- When a house is deleted (e.g. during testing) the ON DELETE CASCADE
-- on house_members should remove rows automatically. However, if the
-- house was deleted via the Supabase dashboard while bypassing RLS,
-- or if the cascade did not fire, orphaned rows remain. These cause
-- returning users to load a ghost house with no name and no invite code.
-- This migration removes all such orphaned rows once.

DELETE FROM house_members
WHERE house_id NOT IN (SELECT id FROM houses);
