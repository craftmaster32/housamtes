-- A photo of a product, remembered by item name for the whole house.
-- Add "Milk" again next week and the same photo shows up.
-- The image itself lives in the private house-photos bucket under
-- "<house_id>/<timestamp>_grocery_<...>.jpg", which the existing storage
-- policies already limit to members of that house.

CREATE TABLE IF NOT EXISTS grocery_product_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  -- Lower-cased, trimmed, single-spaced item name.
  name_key text NOT NULL CHECK (char_length(name_key) BETWEEN 1 AND 200),
  storage_path text NOT NULL CHECK (storage_path LIKE house_id::text || '/%'),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (house_id, name_key)
);

CREATE INDEX IF NOT EXISTS idx_grocery_product_photos_house_id
  ON grocery_product_photos(house_id);

ALTER TABLE grocery_product_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house members can read product photos" ON grocery_product_photos;
DROP POLICY IF EXISTS "house members can add product photos" ON grocery_product_photos;
DROP POLICY IF EXISTS "house members can update product photos" ON grocery_product_photos;
DROP POLICY IF EXISTS "house members can delete product photos" ON grocery_product_photos;

CREATE POLICY "house members can read product photos" ON grocery_product_photos
  FOR SELECT TO authenticated
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE POLICY "house members can add product photos" ON grocery_product_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND added_by = auth.uid()
  );

CREATE POLICY "house members can update product photos" ON grocery_product_photos
  FOR UPDATE TO authenticated
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()))
  WITH CHECK (
    house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid())
    AND added_by = auth.uid()
  );

CREATE POLICY "house members can delete product photos" ON grocery_product_photos
  FOR DELETE TO authenticated
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION set_grocery_product_photos_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grocery_product_photos_updated_at ON grocery_product_photos;
CREATE TRIGGER trg_grocery_product_photos_updated_at
  BEFORE UPDATE ON grocery_product_photos
  FOR EACH ROW EXECUTE FUNCTION set_grocery_product_photos_updated_at();
