-- ============================================================
-- HouseMates — Push notification tokens
-- Stores each user's Expo push token so Edge Functions
-- can send notifications to the right device.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house_id   uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  token      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, house_id)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id  ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_house_id ON push_tokens(house_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own token
CREATE POLICY "users can upsert own token"
  ON push_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own token"
  ON push_tokens FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "users can read own token"
  ON push_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can delete own token"
  ON push_tokens FOR DELETE
  USING (user_id = auth.uid());
