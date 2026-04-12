-- ============================================================
-- Fix handle_new_user trigger for Supabase compatibility
-- ============================================================
-- Supabase restricts the default search_path in SECURITY DEFINER
-- functions. Without an explicit schema reference and SET search_path,
-- the trigger may fail to locate the profiles table, causing a 500
-- on signup. This replaces the trigger with the Supabase-recommended
-- pattern: fully-qualified table name + SET search_path = public.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', '#6366f1')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
