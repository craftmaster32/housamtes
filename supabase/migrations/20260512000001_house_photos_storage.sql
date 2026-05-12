-- ============================================================
-- HouseMates — house-photos storage bucket + object policies
-- ============================================================
-- The photos table has RLS but the storage bucket was never
-- provisioned, causing every upload to fail with a storage error.
--
-- Object key format: {house_id}/{timestamp}_{filename}
--   house_id  — standard UUID  [0-9a-f-]{36}
--   timestamp — Date.now() ms  [0-9]{13,}
--   filename  — original file name

-- Create or converge the bucket to the expected configuration.
-- DO UPDATE ensures a pre-existing misconfigured bucket (e.g. public=false)
-- is corrected rather than silently left as-is.
INSERT INTO storage.buckets (id, name, public)
VALUES ('house-photos', 'house-photos', true)
ON CONFLICT (id) DO UPDATE
  SET name   = EXCLUDED.name,
      public = EXCLUDED.public;

-- Drop any pre-existing policies so this migration is idempotent
DROP POLICY IF EXISTS "house members can upload to house-photos"    ON storage.objects;
DROP POLICY IF EXISTS "house members can read from house-photos"    ON storage.objects;
DROP POLICY IF EXISTS "house members can delete from house-photos"  ON storage.objects;
DROP POLICY IF EXISTS "house members cannot update house-photos"    ON storage.objects;

-- Shared key-format predicate (used in all three permissive policies):
--   1. Regex guard rejects malformed keys before any further evaluation,
--      avoiding cast errors on unexpected input.
--   2. Text comparison avoids the runtime error that ::uuid throws on
--      non-UUID first segments.

-- INSERT: authenticated house member uploading into their own house folder
CREATE POLICY "house members can upload to house-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'house-photos'
    AND name ~ '^[0-9a-f-]{36}/[0-9]{13,}_.+$'
    AND split_part(name, '/', 1) IN (
      SELECT house_id::text FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- SELECT: house member can list/download from their house folder
CREATE POLICY "house members can read from house-photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'house-photos'
    AND name ~ '^[0-9a-f-]{36}/[0-9]{13,}_.+$'
    AND split_part(name, '/', 1) IN (
      SELECT house_id::text FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- DELETE: house member can remove files from their house folder
-- (database-level RLS already enforces that only the uploader can delete the record)
CREATE POLICY "house members can delete from house-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'house-photos'
    AND name ~ '^[0-9a-f-]{36}/[0-9]{13,}_.+$'
    AND split_part(name, '/', 1) IN (
      SELECT house_id::text FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- UPDATE: explicitly blocked — files are write-once; use delete + re-upload instead
CREATE POLICY "house members cannot update house-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);
