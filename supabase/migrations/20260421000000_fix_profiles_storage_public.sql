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

-- Allow any authenticated user to read profile media for housemates.
-- Signed URLs for avatars require the caller to have SELECT on the object.
DROP POLICY IF EXISTS "profile media: owner read" ON storage.objects;
DROP POLICY IF EXISTS "profile media: authenticated read" ON storage.objects;
CREATE POLICY "profile media: authenticated read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'profiles'
    AND auth.role() = 'authenticated'
  );
