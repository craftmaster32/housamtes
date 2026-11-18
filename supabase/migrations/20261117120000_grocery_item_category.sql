-- Lets a housemate move an item to another aisle by hand.
-- NULL means "guess from the name" (the old behaviour), so existing rows are unchanged.
-- grocery_items already has RLS; the existing per-operation policies cover this column.
ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS category text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grocery_items_category_check'
  ) THEN
    ALTER TABLE grocery_items
      ADD CONSTRAINT grocery_items_category_check CHECK (
        category IS NULL OR category IN (
          'produce', 'dairy', 'bakery', 'meat_fish', 'pantry', 'frozen', 'snacks', 'drinks',
          'household', 'personal_care', 'health', 'baby', 'pets', 'other'
        )
      );
  END IF;
END $$;
