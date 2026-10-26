-- ============================================================
-- Photos — any housemate can delete any photo in their house
-- ============================================================
-- Owner's choice: the photo viewer shows Delete on every photo (no more
-- Report), so the house can clear out any picture together. Before this,
-- only the uploader could delete a row ("users can delete own photos").
-- The house-photos storage DELETE policy is already house-wide.

DROP POLICY IF EXISTS "users can delete own photos" ON photos;
DROP POLICY IF EXISTS "house members can delete photos" ON photos;

CREATE POLICY "house members can delete photos"
  ON photos FOR DELETE
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));
