-- ============================================================
-- Fix avatar RLS, add cover_url, create unified profiles bucket
-- ============================================================

-- 1. New column on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- 2. Create a single public bucket for all user profile media
--    (avatar + cover) using folder paths: {userId}/avatar, {userId}/cover
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles', 'profiles', true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Drop old avatar policies (wrong path format — used bare uuid as name)
DROP POLICY IF EXISTS "users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "users can delete own avatar" ON storage.objects;

-- 4. New folder-based policies for the profiles bucket.
--    Path pattern: {userId}/{avatar|cover}
--    (storage.foldername(name))[1] extracts the first path segment (the userId folder).
DROP POLICY IF EXISTS "profile media: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "profile media: owner update" ON storage.objects;
DROP POLICY IF EXISTS "profile media: owner delete" ON storage.objects;

CREATE POLICY "profile media: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "profile media: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "profile media: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
