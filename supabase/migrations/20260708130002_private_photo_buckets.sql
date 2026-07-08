-- ============================================================
-- Make photo storage buckets private
-- ============================================================
-- Problem: house-photos and profiles buckets were public = true, so anyone
-- on the internet who obtains an object URL (shared link, browser history,
-- link preview, log) can view household photos and avatars without logging
-- in. Public-bucket reads bypass the storage RLS policies entirely.
--
-- Fix: flip both buckets to private. Every read path in the app already
-- goes through createSignedUrl (avatars/covers) or is updated in this
-- change to do so (house photos), and signed-URL creation enforces the
-- existing storage.objects SELECT policies.
--
-- NOTE: deploy the updated web app right after pushing this migration —
-- until then, previously stored public photo URLs will stop loading.

UPDATE storage.buckets SET public = false WHERE id = 'house-photos';
UPDATE storage.buckets SET public = false WHERE id = 'profiles';
