-- ============================================================
-- Fix profiles storage bucket: force public + add SELECT policy
-- ON CONFLICT DO UPDATE overrides a pre-existing private bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles', 'profiles', true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to read their own profile media.
-- Public bucket flag handles anonymous reads; this handles
-- createSignedUrl() calls from authenticated users.
DROP POLICY IF EXISTS "profile media: owner read" ON storage.objects;
CREATE POLICY "profile media: owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
