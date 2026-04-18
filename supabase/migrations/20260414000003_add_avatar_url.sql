-- ============================================================
-- Add avatar_url to profiles + create avatars storage bucket
-- ============================================================

-- 1. New column on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Public storage bucket for user avatars (5 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS — each user can only write their own avatar file.
--    Reading is unrestricted because the bucket is public.
DROP POLICY IF EXISTS "users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "users can delete own avatar" ON storage.objects;

CREATE POLICY "users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = name);

CREATE POLICY "users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = name);

CREATE POLICY "users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = name);
