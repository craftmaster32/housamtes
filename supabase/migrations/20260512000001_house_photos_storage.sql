-- ============================================================
-- HouseMates — house-photos storage bucket + object policies
-- ============================================================
-- The photos table has RLS but the storage bucket was never
-- provisioned, causing every upload to fail with a storage error.

-- Create the bucket (public so getPublicUrl works without auth tokens)
INSERT INTO storage.buckets (id, name, public)
VALUES ('house-photos', 'house-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop any pre-existing policies so this migration is idempotent
DROP POLICY IF EXISTS "house members can upload to house-photos"    ON storage.objects;
DROP POLICY IF EXISTS "house members can read from house-photos"    ON storage.objects;
DROP POLICY IF EXISTS "house members can delete from house-photos"  ON storage.objects;
DROP POLICY IF EXISTS "house members cannot update house-photos"    ON storage.objects;

-- INSERT: authenticated house member, uploading into their own house folder
-- Path format: {house_id}/{timestamp}_{filename}
CREATE POLICY "house members can upload to house-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'house-photos'
    AND split_part(name, '/', 1)::uuid IN (
      SELECT house_id FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- SELECT: house member can list/download from their house folder
CREATE POLICY "house members can read from house-photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'house-photos'
    AND split_part(name, '/', 1)::uuid IN (
      SELECT house_id FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- DELETE: house member can remove files from their house folder
-- (database-level RLS already enforces that only the uploader can delete the record)
CREATE POLICY "house members can delete from house-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'house-photos'
    AND split_part(name, '/', 1)::uuid IN (
      SELECT house_id FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- UPDATE: explicitly blocked — files are write-once; use delete + re-upload instead
CREATE POLICY "house members cannot update house-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);
